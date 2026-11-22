import { beforeEach, describe, expect, it, vi } from "vitest";

const { suggestWords, getEditions } = vi.hoisted(() => ({ suggestWords: vi.fn(), getEditions: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/search", () => ({ suggestWords }));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<object>()), getEditions }));

import { GET } from "@/app/api/search/suggest/route";
import { ApiUnavailable } from "@/lib/api";
import { config } from "@/proxy";

let ip = 0;
const get = (qs: string, from = `203.0.113.${++ip}`) =>
  GET(new Request(`https://site.test/api/search/suggest?${qs}`, { headers: { "x-real-ip": from } }));

beforeEach(() => {
  suggestWords.mockReset().mockResolvedValue(["light", "lights"]);
  getEditions.mockReset().mockResolvedValue([{ sigla: "NABRE" }, { sigla: "DRB" }]);
});

describe("/api/search/suggest", () => {
  it("returnsTheEditionsWordsCachedForAnHour", async () => {
    const res = await get("edition=nabre&prefix=lig");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ suggestions: ["light", "lights"] });
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(suggestWords).toHaveBeenCalledWith("NABRE", "lig");
  });

  it("refusesAnUnknownEdition", async () => {
    expect((await get("edition=nope&prefix=lig")).status).toBe(400);
    expect(suggestWords).not.toHaveBeenCalled();
  });

  it("refusesAPrefixOutsideTwoToFortyLetters", async () => {
    expect((await get("edition=nabre&prefix=l")).status).toBe(400);
    expect((await get(`edition=nabre&prefix=${"a".repeat(41)}`)).status).toBe(400);
    expect((await get("edition=nabre&prefix=l%25")).status).toBe(400);
    expect(suggestWords).not.toHaveBeenCalled();
  });

  it("answers429PastSixtyAMinuteFromOneAddress", async () => {
    for (let i = 0; i < 60; i++) expect((await get("edition=nabre&prefix=lig", "198.51.100.9")).status).toBe(200);
    const res = await get("edition=nabre&prefix=lig", "198.51.100.9");
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("answersNoSuggestionsWhenTheApiIsDown", async () => {
    suggestWords.mockRejectedValue(new ApiUnavailable());
    const res = await get("edition=nabre&prefix=lig");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ suggestions: [] });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("isNotRoutedThroughTheI18nProxy", () => {
    expect(new RegExp(`^${config.matcher[0]}$`).test("/api/search/suggest")).toBe(false);
  });
});
