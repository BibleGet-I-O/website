import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withPublicServer } from "@/lib/api-docs";
import { GET as openapi } from "@/app/scalar/openapi.json/route";

const doc = { openapi: "3.0.3", servers: [{ url: "https://internal/dev" }], paths: { "/quote": {} } };

beforeEach(() => {
  process.env.BIBLEGET_API_URL = "https://api.test/dev/";
  delete process.env.BIBLEGET_API_PUBLIC_URL;
  process.env.BIBLEGET_READ_KEY = "read-key";
});
afterEach(() => vi.unstubAllGlobals());

describe("the API reference's document", () => {
  it("hasThePublicApiAsItsOnlyServer", () => {
    const out = withPublicServer(doc, "https://query.bibleget.io/dev");
    expect(out.servers).toEqual([{ url: "https://query.bibleget.io/dev", description: "BibleGet I/O API" }]);
    expect(out.paths).toEqual(doc.paths);
  });

  it("isFetchedFromTheApiWithoutAnyKey", async () => {
    const fetch = vi.fn(async () => Response.json(doc));
    vi.stubGlobal("fetch", fetch);
    const res = await openapi();
    expect(res.status).toBe(200);
    expect((await res.json()).servers).toEqual([{ url: "https://api.test/dev", description: "BibleGet I/O API" }]);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit | undefined];
    expect(url).toBe("https://api.test/dev/openapi.json");
    expect(JSON.stringify(init ?? {})).not.toContain("read-key");
  });

  it("namesThePublicAddressWhenTheApiIsReachedInternally", async () => {
    process.env.BIBLEGET_API_PUBLIC_URL = "https://query.bibleget.io/dev";
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(doc)));
    expect((await (await openapi()).json()).servers[0].url).toBe("https://query.bibleget.io/dev");
  });

  it("anEmptyPublicAddressFallsBackToTheApisOwn", async () => {
    process.env.BIBLEGET_API_PUBLIC_URL = "";
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(doc)));
    expect((await (await openapi()).json()).servers[0].url).toBe("https://api.test/dev");
  });

  it("answers502WhenTheBodyCannotBeRead", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not json", { status: 200, headers: { "content-type": "application/json" } })));
    expect((await openapi()).status).toBe(502);
  });

  it("answers502WhenTheApiCannotGiveIt", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect((await openapi()).status).toBe(502);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    expect((await openapi()).status).toBe(502);
  });
});
