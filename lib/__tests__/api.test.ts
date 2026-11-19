import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { ApiUnavailable, NotFound, getChapter, slugFor } from "../api";

const raw = (verse: number, extra: object = {}) => ({
  chapter: 11, verse, text: `v${verse}`, title1: null, title2: null, title3: null,
  printed_chapter: null, verse_label: null, ...extra,
});
const rows = (n: number) => Array.from({ length: n }, (_, i) => raw(i + 1));
const quote = (results: object[], errors: object[] = []) => ({ results, errors, notices: [], info: {} });
const index = (verses: number) => ({
  indexes: { DRB: { abbreviations: ["Ws"], biblebooks: ["Wisdom"], chapter_limit: [11], verse_limit: [Array(10).fill(10).concat([verses])], book_num: [26] } },
});
const json = (body: unknown, status = 200, type = "application/json") =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": type } });

function mockFetch(q: () => Response | Promise<Response>, verses = 48) {
  const fn = vi.fn(async (url: string | URL | Request, _init?: RequestInit) =>
    String(url).includes("/metadata/versionindex") ? json(index(verses)) : q());
  vi.stubGlobal("fetch", fn);
  return fn;
}
const quoteCall = (fn: ReturnType<typeof mockFetch>) =>
  fn.mock.calls.find((c) => String(c[0]).includes("/quote"))! as unknown as [string, RequestInit & { next?: unknown }];
const base = { sigla: "DRB", bookAbbrev: "Ws", chapter: 11, access: "visitor" as const };

beforeEach(() => {
  process.env.BIBLEGET_API_URL = "https://api.test/dev";
  process.env.BIBLEGET_READ_KEY = "read-key";
  process.env.BIBLEGET_READER_KEY = "reader-key";
});
afterEach(() => vi.unstubAllGlobals());

describe("getChapter", () => {
  it("usesTheReadKeyForVisitorsAndTheReaderKeyForReaders", async () => {
    const fn = mockFetch(() => json(quote(rows(48))));
    await getChapter(base);
    expect(quoteCall(fn)[1].headers).toMatchObject({ "X-Api-Key": "read-key" });
    expect(quoteCall(fn)[1].next).toEqual({ revalidate: 3600 });
    const fn2 = mockFetch(() => json(quote(rows(48))));
    await getChapter({ ...base, access: "reader" });
    expect(quoteCall(fn2)[1].headers).toMatchObject({ "X-Api-Key": "reader-key" });
    expect(quoteCall(fn2)[1].cache).toBe("no-store");
  });

  it("requestsEditionNumbering", async () => {
    const fn = mockFetch(() => json(quote(rows(48))));
    await getChapter({ ...base, tradition: "x" });
    const url = quoteCall(fn)[0];
    expect(url).toContain("numbering=edition");
    expect(url).toContain("query=Ws11");
    expect(url).toContain("return=json");
    expect(url).toContain("text_tradition=x");
  });

  it("requestsHebrewNumberingWithoutTheEditionParameter", async () => {
    const fn = mockFetch(() => json(quote(rows(48))));
    await getChapter({ ...base, numbering: "hebrew" });
    expect(quoteCall(fn)[0]).not.toContain("numbering=");
  });

  it("marksA48VerseChapterCappedAt30AsTruncated", async () => {
    mockFetch(() => json(quote(rows(30))), 48);
    const c = await getChapter(base);
    expect(c.truncated).toBe(true);
    expect(c.expectedVerses).toBe(48);
  });

  it("doesNotMarkAnExactly30VerseChapterAsTruncated", async () => {
    mockFetch(() => json(quote(rows(30))), 30);
    expect((await getChapter(base)).truncated).toBe(false);
  });

  it("mapsPrintedChapterAndLabel", async () => {
    mockFetch(() => json(quote([
      raw(1, { printed_chapter: 10, verse_label: "1a", title1: "T1", title2: "T2", psalm_hebrew: "23:1" }),
    ])), 1);
    const [r] = (await getChapter(base)).rows;
    expect(r).toMatchObject({ printedChapter: 10, label: "1a", titles: ["T1", "T2"], psalmHebrew: "23:1" });
    const { psalmHebrew: _, ...plain } = r;
    expect(plain.verse).toBe(1);
  });

  it("throwsApiUnavailableOn503AndNetworkError", async () => {
    mockFetch(() => new Response("down", { status: 503 }));
    await expect(getChapter(base)).rejects.toBeInstanceOf(ApiUnavailable);
    mockFetch(() => { throw new TypeError("fetch failed"); });
    await expect(getChapter(base)).rejects.toBeInstanceOf(ApiUnavailable);
  });

  it("throwsNotFoundOnA4xxProblemResponse", async () => {
    mockFetch(() => json({ type: "x", title: "Unprocessable Content", status: 422,
      detail: "No valid Bible versions were requested." }, 422, "application/problem+json"));
    await expect(getChapter({ ...base, sigla: "XXX" })).rejects.toBeInstanceOf(NotFound);
  });

  it("throwsNotFoundOnA200WithErrorsAndNoResults", async () => {
    mockFetch(() => json(quote([], [{ errNum: 13, errMessage: "A chapter in the query is out of bounds: there is no chapter <29> in the book in the requested version DRB, the last possible chapter is <28>" }])));
    await expect(getChapter({ ...base, chapter: 29 })).rejects.toBeInstanceOf(NotFound);
  });
});

describe("slugFor", () => {
  it("slugForStripsDiacritics", () => {
    expect(slugFor({ name: "Génesis" })).toBe("genesis");
    expect(slugFor({ name: "1 Maccabees" })).toBe("1-maccabees");
  });
});
