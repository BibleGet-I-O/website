import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { ApiUnavailable, NotFound, bookBySlug, getChapter, getEditions, slugFor } from "../api";

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
    expect(r.verse).toBe(1);
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

  it("mapsAuthAndRateLimitStatusesToApiUnavailable", async () => {
    for (const status of [401, 403, 408, 429]) {
      mockFetch(() => new Response("x", { status }));
      await expect(getChapter(base)).rejects.toBeInstanceOf(ApiUnavailable);
    }
    for (const status of [400, 404, 422]) {
      mockFetch(() => new Response("x", { status }));
      await expect(getChapter(base)).rejects.toBeInstanceOf(NotFound);
    }
  });

  it("showsAHebrewModeSecondEditionAsReturnedWithoutIndexLookup", async () => {
    // Hebrew Ps 10 is VGCL Ps 9:22-39; the index has only 9 chapters of 30 verses for this book.
    const vgcl = Array.from({ length: 18 }, (_, i) => raw(22 + i, { chapter: 9 }));
    const fn = vi.fn(async (url: string | URL | Request, _init?: RequestInit) =>
      String(url).includes("/metadata/versionindex")
        ? json({ indexes: { VGCL: { abbreviations: ["Psal"], biblebooks: ["Psalmorum"], chapter_limit: [1], verse_limit: [[40]], book_num: [23] } } })
        : json(quote(vgcl)));
    vi.stubGlobal("fetch", fn);
    const c = await getChapter({ sigla: "VGCL", bookAbbrev: "Psal", chapter: 10, access: "visitor", numbering: "hebrew" });
    expect(c.truncated).toBe(false);
    expect(c.expectedVerses).toBe(18);
    expect(c.rows[0].chapter).toBe(9);
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

describe("slugFor edge cases", () => {
  it("makesCleanSlugs", () => {
    expect(slugFor({ name: "1 Samuel" })).toBe("1-samuel");
    expect(slugFor({ name: "Cantico dei Cantici" })).toBe("cantico-dei-cantici");
    expect(slugFor({ name: "Song of Songs / Canticles" })).toBe("song-of-songs-canticles");
    expect(slugFor({ name: "Sirach (Ben Sira)'s" })).toBe("sirach-ben-sira-s");
  });
});

describe("bookBySlug", () => {
  const index = { sigla: "X", books: [{ bookNum: 1, name: "Génesis", abbrev: "Gn", chapters: 50, versesPerChapter: [] }] };
  it("findsAndMissesBooks", () => {
    expect(bookBySlug(index, "genesis")?.abbrev).toBe("Gn");
    expect(bookBySlug(index, "exodus")).toBeUndefined();
  });
});

describe("getEditions", () => {
  it("parsesTheFullnameField", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({
      validversions: ["DRB", "BARE"],
      validversions_fullname: { DRB: "Douay–Rheims Challoner Revision|1752|en|1|CATHOLIC|Some Holder|notes", BARE: "Bare" },
    })));
    expect(await getEditions()).toEqual([
      { sigla: "DRB", fullname: "Douay–Rheims Challoner Revision", year: "1752", language: "en", copyrightHolder: "Some Holder" },
      { sigla: "BARE", fullname: "Bare", year: "", language: "", copyrightHolder: "" },
    ]);
  });
});
