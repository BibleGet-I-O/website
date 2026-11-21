import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { ApiUnavailable } from "../api";
import { searchEdition, suggestWords } from "../search";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const raw = (verse: number, extra: object = {}) => ({
  version: "NABRE", book: "John", univbooknum: 50, chapter: 3, verse, verse_segment: null,
  printed_chapter: null, verse_label: null, text: `v${verse}`, ...extra,
});

function stub(res: () => Response) {
  const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => res());
  vi.stubGlobal("fetch", fn);
  return fn;
}
const url = (fn: ReturnType<typeof stub>) => new URL(String(fn.mock.calls[0][0]));
const key = (fn: ReturnType<typeof stub>) => (fn.mock.calls[0][1]?.headers as Record<string, string>)["X-Api-Key"];
const base = { sigla: "NABRE", q: "light", exact: false, page: 1, access: "visitor" as const };

beforeEach(() => {
  process.env.BIBLEGET_API_URL = "https://api.test/dev";
  process.env.BIBLEGET_READ_KEY = "read-key";
  process.env.BIBLEGET_READER_KEY = "reader-key";
});
afterEach(() => vi.unstubAllGlobals());

describe("searchEdition", () => {
  it("asksKeywordSearchForAPageOfFifty", async () => {
    const fn = stub(() => json({ results: [raw(16)], info: { TOTAL: 120 } }));
    const out = await searchEdition({ ...base, mode: "keyword", page: 3 });
    const u = url(fn);
    expect(u.pathname).toBe("/dev/search/keyword");
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ keyword: "light", version: "NABRE", match: "fulltext", limit: "50", offset: "100" });
    expect(key(fn)).toBe("read-key");
    expect(out).toEqual({
      kind: "ok", total: 120, capped: null,
      hits: [{ bookNum: 50, book: "John", chapter: 3, verse: 16, segment: null, printedChapter: null, label: null, text: "v16" }],
    });
  });

  it("exactWordsAskMatchExact", async () => {
    const fn = stub(() => json({ results: [], info: { TOTAL: 0 } }));
    await searchEdition({ ...base, mode: "keyword", exact: true });
    expect(url(fn).searchParams.get("match")).toBe("exact");
  });

  it("asksSemanticAndHybridForThirty", async () => {
    for (const mode of ["semantic", "hybrid"] as const) {
      const fn = stub(() => json({ results: [raw(1), raw(2)], info: {} }));
      const out = await searchEdition({ ...base, mode, q: "God forgives" });
      const u = url(fn);
      expect(u.pathname).toBe(`/dev/search/${mode}`);
      expect(Object.fromEntries(u.searchParams)).toMatchObject({ query: "God forgives", version: "NABRE", limit: "30" });
      expect(out).toMatchObject({ kind: "ok", total: 2, capped: null });
      vi.unstubAllGlobals();
    }
  });

  it("usesTheReaderKeyForAReader", async () => {
    const fn = stub(() => json({ results: [], info: { TOTAL: 0 } }));
    await searchEdition({ ...base, mode: "keyword", access: "reader" });
    expect(key(fn)).toBe("reader-key");
  });

  it("readsTheCapFromInfoCapped", async () => {
    stub(() => json({ results: [raw(1)], info: { TOTAL: 30, CAPPED: { NABRE: 252 } } }));
    expect(await searchEdition({ ...base, mode: "keyword" })).toMatchObject({ total: 30, capped: 252 });
  });

  it("aRefusedKeywordIsRefused", async () => {
    stub(() => json({ status: 422, title: "Unprocessable" }, 422));
    expect(await searchEdition({ ...base, mode: "keyword", q: "the" })).toEqual({ kind: "refused" });
  });

  it("semanticDownIsSemanticUnavailable", async () => {
    stub(() => json({ status: 503 }, 503));
    expect(await searchEdition({ ...base, mode: "semantic" })).toEqual({ kind: "semanticUnavailable" });
  });

  it("otherFailuresAreTheApiUnavailable", async () => {
    stub(() => json({}, 500));
    await expect(searchEdition({ ...base, mode: "keyword" })).rejects.toBeInstanceOf(ApiUnavailable);
    stub(() => json({}, 401));
    await expect(searchEdition({ ...base, mode: "keyword" })).rejects.toBeInstanceOf(ApiUnavailable);
  });

  it("showsThePlainTextNotTheEditionsMarkup", async () => {
    stub(() => json({ results: [raw(1, { text: "<i>Fiat</i> lux", text_plain: "Fiat lux" })], info: { TOTAL: 1 } }));
    const out = await searchEdition({ ...base, mode: "keyword" });
    expect(out.kind === "ok" && out.hits[0].text).toBe("Fiat lux");
  });

  it("keepsThePrintedChapterAndLabel", async () => {
    stub(() => json({ results: [raw(1, { chapter: 12, printed_chapter: 11, verse_label: "12:1", verse_segment: "a" })], info: { TOTAL: 1 } }));
    const out = await searchEdition({ ...base, mode: "keyword" });
    expect(out.kind === "ok" && out.hits[0]).toMatchObject({ chapter: 12, printedChapter: 11, label: "12:1", segment: "a" });
  });
});

describe("suggestWords", () => {
  it("returnsTheWordsOnlyWithTheReadKey", async () => {
    const fn = stub(() => json({ suggestions: [{ word: "light", count: 252 }, { word: "lights", count: 3 }], info: {} }));
    expect(await suggestWords("NABRE", "lig")).toEqual(["light", "lights"]);
    expect(Object.fromEntries(url(fn).searchParams)).toEqual({ prefix: "lig", version: "NABRE", limit: "8" });
    expect(url(fn).pathname).toBe("/dev/search/suggest");
    expect(key(fn)).toBe("read-key");
  });
});
