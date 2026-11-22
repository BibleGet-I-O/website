// @vitest-environment node
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** A small CacheStorage: caches by name, entries by URL, in insertion order. */
class FakeCache {
  entries = new Map<string, Response>();
  async put(req: { url: string } | string, res: Response) {
    const url = typeof req === "string" ? new URL(req, ORIGIN).href : req.url;
    this.entries.delete(url);
    this.entries.set(url, res);
  }
  async match(req: { url: string } | string) {
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
const fetchMock = vi.fn(async (req: Req) => {
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
    addEventListener: (type: string, fn: (e: unknown) => void) => (listeners[type] = fn),
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined) },
  };
  new Function("self", "caches", "fetch", "URL", readFileSync("public/sw.js", "utf8"))(self, caches, fetchMock, URL);
}

const req = (path: string, o: Partial<Req> = {}): Req => ({ url: ORIGIN + path, method: "GET", mode: "navigate", headers: new Headers(), ...o });

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

  it("activateDropsAnEarlierShellAndTakesOverOpenPages", async () => {
    await caches.open("bg-shell-v0");
    await lifecycle("activate");
    expect(await caches.keys()).not.toContain("bg-shell-v0");
  });
});
