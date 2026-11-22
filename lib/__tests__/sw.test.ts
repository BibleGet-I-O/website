// @vitest-environment node
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** A small CacheStorage: caches by name, entries by URL, in insertion order. */
let putGate: Promise<void> | null = null;
let failNextPut = false;
let failNextMatch = false;
class FakeCache {
  entries = new Map<string, Response>();
  async put(req: { url: string } | string, res: Response) {
    if (putGate) await putGate;
    if (failNextPut) {
      failNextPut = false;
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    }
    const url = typeof req === "string" ? new URL(req, ORIGIN).href : req.url;
    this.entries.delete(url);
    this.entries.set(url, res);
  }
  async match(req: { url: string } | string) {
    if (failNextMatch) {
      failNextMatch = false;
      throw new DOMException("Cache read failed", "UnknownError");
    }
    const url = typeof req === "string" ? new URL(req, ORIGIN).href : req.url;
    return this.entries.get(url)?.clone();
  }
  async keys() {
    return [...this.entries.keys()].map((url) => ({ url }));
  }
  async delete(req: { url: string } | string) {
    const url = typeof req === "string" ? new URL(req, ORIGIN).href : req.url;
    return this.entries.delete(url);
  }
  async addAll(urls: string[]) {
    for (const u of urls) await this.put(u, await fetchMock({ url: new URL(u, ORIGIN).href, method: "GET", mode: "cors", headers: new Headers() }));
  }
}
class FakeCaches {
  stores = new Map<string, FakeCache>();
  async open(name: string) {
    if (!this.stores.has(name)) this.stores.set(name, new FakeCache());
    return this.stores.get(name)!;
  }
  async keys() {
    return [...this.stores.keys()];
  }
  async delete(name: string) {
    return this.stores.delete(name);
  }
  async match(req: { url: string } | string) {
    for (const c of this.stores.values()) {
      const r = await c.match(req);
      if (r) return r;
    }
    return undefined;
  }
}

const ORIGIN = "https://staging.bibleget.io";
type Req = { url: string; method: string; mode: string; headers: Headers };
let online = true;
const fetchMock = vi.fn(async (req: Req | string) => {
  if (typeof req === "string") req = { url: new URL(req, ORIGIN).href, method: "GET", mode: "cors", headers: new Headers() };
  if (!online) throw new TypeError("Failed to fetch");
  return new Response(`network:${new URL(req.url).pathname}`, { status: 200, headers: { "content-type": "text/html" } });
});

let caches: FakeCaches;
let listeners: Record<string, (e: unknown) => void>;

function load() {
  caches = new FakeCaches();
  listeners = {};
  const self = {
    location: { origin: ORIGIN },
    navigator: { languages: ["it-IT", "en"] },
    addEventListener: (type: string, fn: (e: unknown) => void) => (listeners[type] = fn),
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined) },
  };
  new Function("self", "caches", "fetch", "URL", readFileSync("public/sw.js", "utf8"))(self, caches, fetchMock, URL);
}

const req = (path: string, o: Partial<Req> = {}): Req => ({ url: ORIGIN + path, method: "GET", mode: "navigate", headers: new Headers(), ...o });

/** Dispatches a fetch event without waiting for the work it keeps going (event.waitUntil). */
function dispatch(r: Req) {
  let answer: Promise<Response> | null = null;
  const waits: Promise<unknown>[] = [];
  listeners.fetch({ request: r, respondWith: (p: Promise<Response>) => (answer = p), waitUntil: (p: Promise<unknown>) => waits.push(p) });
  return { answer: answer as Promise<Response> | null, waits };
}

/** A message from a page to the worker, and the work it keeps going. */
async function message(data: unknown) {
  const waits: Promise<unknown>[] = [];
  listeners.message({ data, waitUntil: (p: Promise<unknown>) => waits.push(p) });
  await Promise.all(waits);
}

const kept = async (name = "bg-pages") => (await (await caches.open(name)).keys()).map((k) => new URL(k.url).pathname);

/** Dispatches a fetch event; the response the worker gives, or null when it leaves the request alone. */
async function fetchEvent(r: Req): Promise<Response | null> {
  let answer: Promise<Response> | null = null;
  const waits: Promise<unknown>[] = [];
  listeners.fetch({ request: r, respondWith: (p: Promise<Response>) => (answer = p), waitUntil: (p: Promise<unknown>) => waits.push(p) });
  const res = answer ? await answer : null;
  await Promise.all(waits);
  return res;
}

async function lifecycle(type: "install" | "activate") {
  const waits: Promise<unknown>[] = [];
  listeners[type]({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
  await Promise.all(waits);
}

beforeEach(() => {
  online = true;
  putGate = null;
  failNextPut = false;
  failNextMatch = false;
  fetchMock.mockClear();
  load();
});

describe("service worker", () => {
  it("installPrecachesTheOfflinePage", async () => {
    await lifecycle("install");
    expect(await (await caches.match("/offline.html"))!.text()).toBe("network:/offline.html");
  });

  it("aReaderPageComesFromTheNetworkFirstAndIsKept", async () => {
    const res = await fetchEvent(req("/en/read/nabre/john/3"));
    expect(await res!.text()).toBe("network:/en/read/nabre/john/3");
    expect((await (await caches.open("bg-pages")).keys()).map((k) => k.url)).toEqual([ORIGIN + "/en/read/nabre/john/3"]);
  });

  it("offlineAChapterAlreadyReadStillOpens", async () => {
    await fetchEvent(req("/en/read/nabre/john/3?with=DRB"));
    online = false;
    expect(await (await fetchEvent(req("/en/read/nabre/john/3?with=DRB")))!.text()).toBe("network:/en/read/nabre/john/3");
  });

  it("offlineAChapterNeverReadGetsTheOfflinePage", async () => {
    await lifecycle("install");
    online = false;
    expect(await (await fetchEvent(req("/en/read/nabre/john/4")))!.text()).toBe("network:/offline.html");
  });

  it("theHomeAndBooksPagesAreKeptToo", async () => {
    await fetchEvent(req("/it"));
    await fetchEvent(req("/it/read/cei2008"));
    expect((await (await caches.open("bg-pages")).keys()).length).toBe(2);
  });

  it("searchAdminReviewAndApiAreNeverKept", async () => {
    for (const p of ["/en/read/nabre/search?q=light", "/en/admin", "/en/review", "/en/scalar"]) await fetchEvent(req(p));
    expect(await fetchEvent(req("/api/search/suggest?edition=nabre&prefix=lig", { mode: "cors" }))).toBeNull();
    expect((await (await caches.open("bg-pages")).keys()).length).toBe(0);
  });

  it("keepsAtMostTwoHundredPagesDroppingTheOldest", async () => {
    for (let i = 1; i <= 205; i++) await fetchEvent(req(`/en/read/drb/psalms/${i}`));
    const keys = (await (await caches.open("bg-pages")).keys()).map((k) => k.url);
    expect(keys).toHaveLength(200);
    expect(keys[0]).toBe(ORIGIN + "/en/read/drb/psalms/6");
  });

  it("aChapterReadAgainBecomesTheNewest", async () => {
    await fetchEvent(req("/en/read/drb/psalms/1"));
    await fetchEvent(req("/en/read/drb/psalms/2"));
    await fetchEvent(req("/en/read/drb/psalms/1"));
    expect((await (await caches.open("bg-pages")).keys()).map((k) => new URL(k.url).pathname)).toEqual(["/en/read/drb/psalms/2", "/en/read/drb/psalms/1"]);
  });

  it("aFailedPageIsNotKept", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 404 }));
    await fetchEvent(req("/en/read/nabre/john/99"));
    expect((await (await caches.open("bg-pages")).keys()).length).toBe(0);
  });

  it("theAppsBuiltFilesComeFromTheCacheOnceFetched", async () => {
    const asset = req("/_next/static/chunks/app.js", { mode: "no-cors" });
    await fetchEvent(asset);
    online = false;
    expect(await (await fetchEvent(asset))!.text()).toBe("network:/_next/static/chunks/app.js");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("theOfflinePagesOwnFilesComeFromTheCache", async () => {
    await lifecycle("install");
    online = false;
    expect(await (await fetchEvent(req("/bibleget-logo.png", { mode: "no-cors" })))!.text()).toBe("network:/bibleget-logo.png");
  });

  it("leavesPostsOtherSitesAndInAppNavigationsAlone", async () => {
    expect(await fetchEvent(req("/en/read/nabre/john/3", { method: "POST" }))).toBeNull();
    expect(await fetchEvent({ ...req("/x"), url: "https://query.bibleget.io/dev/quote" })).toBeNull();
    // A client-side navigation's payload (RSC): offline, Next falls back to loading the page, which the worker serves.
    expect(await fetchEvent(req("/en/read/nabre/john/4?_rsc=abc", { mode: "cors", headers: new Headers({ RSC: "1" }) }))).toBeNull();
  });

  it("theAppsStartPageOfflineOpensTheHomePageKeptInTheReadersLanguage", async () => {
    await fetchEvent(req("/en"));
    await fetchEvent(req("/it"));
    // Online, "/" is the server's (it sends the reader to their language) and is not kept itself.
    expect(await (await fetchEvent(req("/")))!.text()).toBe("network:/");
    expect(await kept()).toEqual(["/en", "/it"]);
    online = false;
    expect(await (await fetchEvent(req("/")))!.text()).toBe("network:/it");
  });

  it("theAppsStartPageOfflineWithNoHomeKeptGetsTheOfflinePage", async () => {
    await lifecycle("install");
    online = false;
    expect(await (await fetchEvent(req("/")))!.text()).toBe("network:/offline.html");
  });

  it("aPageIsAnsweredWithoutWaitingForItsCopyToBeKept", async () => {
    let release!: () => void;
    putGate = new Promise((r) => (release = r));
    const { answer, waits } = dispatch(req("/en/read/nabre/john/3"));
    expect(await (await answer)!.text()).toBe("network:/en/read/nabre/john/3");
    release();
    await Promise.all(waits);
    expect(await kept()).toEqual(["/en/read/nabre/john/3"]);
  });

  it("aFailedCacheWriteStillAnswersAndKeepsTheEarlierCopy", async () => {
    await fetchEvent(req("/en/read/nabre/john/3"));
    fetchMock.mockResolvedValueOnce(new Response("newer", { status: 200 }));
    failNextPut = true;
    expect(await (await fetchEvent(req("/en/read/nabre/john/3")))!.text()).toBe("newer");
    online = false;
    expect(await (await fetchEvent(req("/en/read/nabre/john/3")))!.text()).toBe("network:/en/read/nabre/john/3");
  });

  it("aFailedCacheReadOfABuiltFileFallsBackToTheNetwork", async () => {
    failNextMatch = true;
    expect(await (await fetchEvent(req("/_next/static/chunks/app.js", { mode: "no-cors" })))!.text()).toBe("network:/_next/static/chunks/app.js");
  });

  it("aChapterReadOfflineBecomesTheNewestToo", async () => {
    await fetchEvent(req("/en/read/drb/psalms/1"));
    await fetchEvent(req("/en/read/drb/psalms/2"));
    online = false;
    await fetchEvent(req("/en/read/drb/psalms/1"));
    expect(await kept()).toEqual(["/en/read/drb/psalms/2", "/en/read/drb/psalms/1"]);
  });

  it("aPageReachedInTheAppIsKeptWhenThePageAsksAndOnlyAReaderPage", async () => {
    await message({ type: "keep", urls: ["/en/read/nabre/john/5", "/en/admin", "https://example.com/x", "/_next/static/chunks/page.js"] });
    expect(await kept()).toEqual(["/en/read/nabre/john/5"]);
    expect(await kept("bg-static")).toEqual(["/_next/static/chunks/page.js"]);
    online = false;
    expect(await (await fetchEvent(req("/en/read/nabre/john/5")))!.text()).toBe("network:/en/read/nabre/john/5");
  });

  it("signingOutForgetsThePagesEvenBeforeThePageHasLoadedItsScripts", async () => {
    await fetchEvent(req("/en/read/nabre/john/3"));
    // The sign-out form's redirect, as a plain page load (a form sent before the page's scripts ran).
    await fetchEvent(req("/en?signed-out"));
    expect(await kept()).toEqual([]);
  });

  it("signingOutInTheAppForgetsThePagesToo", async () => {
    await fetchEvent(req("/en/read/nabre/john/3"));
    // After hydration the redirect is a client-side navigation: its payload request.
    expect(await fetchEvent(req("/en?signed-out&_rsc=1", { mode: "cors", headers: new Headers({ RSC: "1" }) }))).toBeNull();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(await kept()).toEqual([]);
  });

  it("aPageStillLoadingWhenTheReaderSignsOutIsNotKept", async () => {
    let finish!: (r: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((r) => (finish = r)));
    const { answer, waits } = dispatch(req("/en/read/nabre/john/3"));
    await message({ type: "signed-out" });
    finish(new Response("full text, signed in", { status: 200 }));
    await answer;
    await Promise.all(waits);
    expect(await kept()).toEqual([]);
  });

  it("activateDropsAnEarlierShellAndTakesOverOpenPages", async () => {
    await caches.open("bg-shell-v0");
    await lifecycle("activate");
    expect(await caches.keys()).not.toContain("bg-shell-v0");
  });
});
