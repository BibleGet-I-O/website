import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { ApiUnavailable, NotFound, bookBySlug, getApiVersion, getChapter, getEditions, getIndex, getOutline, getVerses, slugFor } from "../api";

const raw = (verse: number, extra: object = {}) => ({
  chapter: 11, verse, text: `v${verse}`, title1: null, title2: null, title3: null,
  printed_chapter: null, verse_label: null, ...extra,
});
const rows = (n: number) => Array.from({ length: n }, (_, i) => raw(i + 1));
const quote = (results: object[], errors: object[] = []) => ({ results, errors, notices: [], info: {} });
const index = (verses: number) => ({
  indexes: { DRB: { abbreviations: ["Ws"], biblebooks: ["Wisdom"], chapter_limit: [11], verse_limit: [Array(10).fill(10).concat([verses])], book_num: [27] } },
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
    expect(r.titlePosition).toBeNull();
  });

  it("mapsTheVerseSegment", async () => {
    // NVBSE Esther 1:1a: the Greek addition's letter.
    mockFetch(() => json(quote([raw(1, { verse_segment: "a" }), raw(1)])), 2);
    const [a, plain] = (await getChapter(base)).rows;
    expect(a.segment).toBe("a");
    expect(plain.segment).toBeNull();
  });

  it("marksEsthersHebrewRows", async () => {
    mockFetch(() => json(quote([raw(1, { text_tradition: "HEBREW" }), raw(2, { text_tradition: "GREEK" }), raw(3)])));
    expect((await getChapter(base)).rows.map((r) => r.tradition)).toEqual(["HEBREW", undefined, undefined]);
  });

  it("mapsTitlePosition", async () => {
    mockFetch(() => json(quote([raw(1, { title1: "Mid", title_position: 12 })])), 1);
    const [r] = (await getChapter(base)).rows;
    expect(r).toMatchObject({ titles: ["Mid"], titlePosition: 12 });
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

describe("Esther with both texts", () => {
  // NABRE-shaped: versionindex reports Esther with 20 chapters, 10 Hebrew then 10 Greek.
  const hebrew = [22, 23, 15, 17, 14, 14, 10, 17, 32, 3];
  const greek = [22, 23, 15, 17, 14, 14, 10, 17, 32, 13];
  const nabreIndex = {
    indexes: {
      NABRE: {
        abbreviations: ["Est", "1Mc"], biblebooks: ["Esther", "1 Maccabees"], chapter_limit: [20, 16],
        verse_limit: [hebrew.concat(greek), Array(16).fill(50)], book_num: [19, 20],
      },
    },
  };
  const vgclIndex = {
    indexes: { VGCL: { abbreviations: ["Est"], biblebooks: ["Esther"], chapter_limit: [16], verse_limit: [Array(16).fill(20)], book_num: [19] } },
  };
  const stub = (idx: object, results: () => object[]) =>
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) =>
      String(url).includes("/metadata/versionindex") ? json(idx) : json(quote(results()))));
  const esther = (n: number) => Array.from({ length: n }, (_, i) => raw(i + 1, { chapter: 10 }));

  it("splitsTheTwentyChaptersIntoTenWithBothVerseCounts", async () => {
    stub(nabreIndex, () => []);
    const [est, mac] = (await getIndex("NABRE")).books;
    expect(est).toMatchObject({ bookNum: 19, chapters: 10, versesPerChapter: hebrew, greekVersesPerChapter: greek });
    expect(mac).toMatchObject({ bookNum: 20, chapters: 16 });
    expect(mac.greekVersesPerChapter).toBeUndefined();
  });

  it("nvbsePrintsEstherOnceAsItsFullText", async () => {
    // The Nova Vulgata prints Esther once, the Hebrew text with the Greek additions as lettered verses; its
    // Hebrew run in the database repeats the unlettered verses. One text: the Greek run's counts, all of it.
    stub({ indexes: { NVBSE: { ...nabreIndex.indexes.NABRE } } }, () => []);
    const [est] = (await getIndex("NVBSE")).books;
    expect(est).toMatchObject({ bookNum: 19, chapters: 10, versesPerChapter: greek });
    expect(est.greekVersesPerChapter).toBeUndefined();
  });

  it("keepsAVulgateShapedSixteenChapterEsther", async () => {
    stub(vgclIndex, () => []);
    const [est] = (await getIndex("VGCL")).books;
    expect(est.chapters).toBe(16);
    expect(est.versesPerChapter).toHaveLength(16);
    expect(est.greekVersesPerChapter).toBeUndefined();
  });

  it("countsTheVersesOfTheRequestedText", async () => {
    // Esther 10: 3 Hebrew verses, 13 Greek. Greek is the default.
    stub(nabreIndex, () => esther(3));
    const args = { sigla: "NABRE", bookAbbrev: "Est", chapter: 10, access: "visitor" as const };
    expect(await getChapter({ ...args, tradition: "HEBREW" })).toMatchObject({ truncated: false, expectedVerses: 3 });
    expect(await getChapter(args)).toMatchObject({ truncated: true, expectedVerses: 13 });
    expect(await getChapter({ ...args, tradition: "GREEK" })).toMatchObject({ truncated: true, expectedVerses: 13 });
  });
});

describe("notes", () => {
  const params = (fn: ReturnType<typeof mockFetch>) => new URL(String(quoteCall(fn)[0])).searchParams;
  const cross = { kind: "crossref", marker: "a", label: "11:1", title: null, body: "Jn 1:3.", refs: [{ start: { book: 50, chapter: 1, verse: 3, segment: null, printed_chapter: null }, end: null, span: [0, 6] }] };
  const foot = { kind: "footnote", marker: "*", label: "11:1", title: null, body: "On <i>this</i>.", refs: [] };
  const withNotes = () => ({
    results: [
      raw(1, { title1: "", title2: "A heading", notes: [
        { id: "DRB:x-2", kind: "footnote", marker: "*", field: "title2", position: 2 },
        { id: "DRB:x-1", kind: "crossref", marker: "a", field: "text", position: 4 },
        { id: "DRB:x-3", kind: "footnote", marker: null, field: "text", position: null },
      ] }),
      raw(2, { notes: [] }),
    ],
    errors: [], notices: [], info: {},
    notes: { "DRB:x-1": cross, "DRB:x-2": foot, "DRB:x-3": { ...foot, marker: null } },
  });

  it("visitorsAskForNoNotes", async () => {
    const fn = mockFetch(() => json(quote(rows(48))));
    await getChapter(base);
    expect(params(fn).has("footnotes")).toBe(false);
  });

  it("readersAskForThemAndGetThemOnTheirRows", async () => {
    const fn = mockFetch(() => json(withNotes()));
    const ch = await getChapter({ ...base, access: "reader" });
    expect(params(fn).get("footnotes")).toBe("full");
    const [one, two] = ch.rows;
    expect(one.notes).toEqual([
      { field: "title", titleIndex: 0, position: 2, note: { id: "DRB:x-2", edition: "DRB", ...foot } },
      { field: "text", position: 4, note: { id: "DRB:x-1", edition: "DRB", ...cross, refs: [{ start: { book: 50, chapter: 1, verse: 3, segment: null, printedChapter: null }, end: null, span: [0, 6] }] } },
      { field: "text", position: null, note: { id: "DRB:x-3", edition: "DRB", ...foot, marker: null } },
    ]);
    expect(two.notes).toBeUndefined();
  });

  it("aCitationIntoAnotherEditionSaysWhich", async () => {
    const nv = { ...cross, refs: [{ ...cross.refs[0], edition: "NVBSE" }] };
    mockFetch(() => json({ ...withNotes(), notes: { ...withNotes().notes, "DRB:x-1": nv } }));
    const m = (await getChapter({ ...base, access: "reader" })).rows[0].notes!.find((x) => x.note.id === "DRB:x-1")!;
    expect(m.note.refs[0].edition).toBe("NVBSE");
  });

  it("aMarkerWhoseNoteIsMissingIsDropped", async () => {
    mockFetch(() => json({ ...withNotes(), notes: {} }));
    expect((await getChapter({ ...base, access: "reader" })).rows[0].notes).toBeUndefined();
  });

  it("neighbourVersesCarryTheirNotesToo", async () => {
    const fn = mockFetch(() => json(withNotes()));
    const rowsOut = await getVerses({ ...base, access: "reader", verse: 1 });
    expect(params(fn).get("footnotes")).toBe("full");
    expect(rowsOut[0].notes).toHaveLength(3);
  });
});

describe("Sirach's prologue", () => {
  const sirIndex = {
    indexes: {
      NABRE: {
        abbreviations: ["Wis", "Sir"], biblebooks: ["Wisdom", "Sirach"], chapter_limit: [19, 51],
        verse_limit: [Array(19).fill(20), Array(51).fill(30)], book_num: [27, 28], prologue: [0, 1],
      },
    },
  };
  const stub = (results: () => object[]) => {
    const fn = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("/metadata/versionindex") ? json(sirIndex) : json(quote(results())));
    vi.stubGlobal("fetch", fn);
    return fn;
  };

  it("readsEachBooksPrologue", async () => {
    stub(() => []);
    const [wis, sir] = (await getIndex("NABRE")).books;
    expect(wis.prologue).toBe(0);
    expect(sir.prologue).toBe(1);
  });

  it("anIndexWithoutProloguesHasNone", async () => {
    mockFetch(() => json(quote([])));
    expect((await getIndex("DRB")).books[0].prologue).toBe(0);
  });

  it("fetchesThePrologueAsChapterZero", async () => {
    const fn = stub(() => [raw(1, { chapter: 0, title1: "Foreword" })]);
    const ch = await getChapter({ sigla: "NABRE", bookAbbrev: "Sir", chapter: 0, access: "reader" });
    expect(new URL(String(quoteCall(fn as never)[0])).searchParams.get("query")).toBe("Sir0");
    expect(ch).toMatchObject({ truncated: false, expectedVerses: 1 });
    expect(ch.rows[0]).toMatchObject({ chapter: 0, verse: 1, titles: ["Foreword"] });
  });
});

describe("getVerses", () => {
  it("requestsOneVerseInTheEditionsNumberingWithoutAnIndexLookup", async () => {
    const fn = mockFetch(() => json(quote([raw(1, { chapter: 12, printed_chapter: 11, verse_label: "12:1" })])));
    const rows = await getVerses({ ...base, chapter: 12, verse: 1, access: "reader", tradition: "GREEK" });
    expect(rows).toEqual([expect.objectContaining({ chapter: 12, verse: 1, printedChapter: 11, label: "12:1" })]);
    const [url, init] = quoteCall(fn);
    const qs = new URL(url).searchParams;
    expect(qs.get("query")).toBe("Ws12:1");
    expect(qs.get("numbering")).toBe("edition");
    expect(qs.get("text_tradition")).toBe("GREEK");
    expect(init.cache).toBe("no-store");
    expect(fn.mock.calls.some((c) => String(c[0]).includes("versionindex"))).toBe(false);
  });

  it("returnsNothingForAVerseTheEndpointDoesNotHave", async () => {
    mockFetch(() => json(quote([], [{ message: "no such verse" }])));
    expect(await getVerses({ ...base, chapter: 12, verse: 1 })).toEqual([]);
  });
});

/** The slug of a book that is alone in its edition. */
const slugOf = (name: string) => slugFor({ bookNum: 1, name }, [{ bookNum: 1, name }]);

describe("getOutline", () => {
  const titles = [{ level: 1, title: "A", chapter: 12, verse: 1, segment: null, printed_chapter: 11 }];

  it("readsABooksTitlesWithTheReadersAccess", async () => {
    const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => json({ titles }));
    vi.stubGlobal("fetch", fn);
    expect(await getOutline("NABRE", 27, "reader")).toEqual([{ level: 1, title: "A", chapter: 12, verse: 1, segment: null, printedChapter: 11 }]);
    expect(String(fn.mock.calls[0][0])).toContain("/metadata/outline?version=NABRE&book=27");
    expect(fn.mock.calls[0][1]).toMatchObject({ cache: "no-store", headers: { "X-Api-Key": "reader-key" } });
    await getOutline("NABRE", 27, "visitor");
    expect(fn.mock.calls[1][1]).toMatchObject({ headers: { "X-Api-Key": "read-key" } });
  });

  it("isEmptyWhenTheEndpointHasNoneOrCannotSay", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ detail: "Unknown metadata query" }, 404, "application/problem+json")));
    expect(await getOutline("NABRE", 1, "visitor")).toEqual([]);
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 503)));
    expect(await getOutline("NABRE", 1, "visitor")).toEqual([]);
    for (const body of [{}, null, { titles: null }, { titles: "x" }, { titles: {} }]) {
      vi.stubGlobal("fetch", vi.fn(async () => json(body)));
      expect(await getOutline("NABRE", 1, "visitor")).toEqual([]);
    }
  });
});

describe("getOutline entries", () => {
  it("leavesOutMalformedOnesAndKeepsTheRest", async () => {
    const good = { level: 1, title: "A", chapter: 1, verse: 2, segment: "a", printed_chapter: null };
    const bad = [null, "x", 3, [], {}, { ...good, level: "1" }, { ...good, level: 0 }, { ...good, title: null }, { ...good, chapter: 1.5 },
      { ...good, verse: -1 }, { ...good, segment: 4 }, { ...good, printed_chapter: "2" }];
    vi.stubGlobal("fetch", vi.fn(async () => json({ titles: [...bad, good, { ...good, segment: undefined, printed_chapter: undefined }] })));
    const kept = { level: 1, title: "A", chapter: 1, verse: 2, segment: "a", printedChapter: null };
    expect(await getOutline("NABRE", 1, "visitor")).toEqual([kept, { ...kept, segment: null }]);
  });
});

describe("slugFor", () => {
  it("slugForStripsDiacritics", () => {
    expect(slugOf("Génesis")).toBe("genesis");
    expect(slugOf("1 Maccabees")).toBe("1-maccabees");
  });
});

describe("slugFor edge cases", () => {
  it("makesCleanSlugs", () => {
    expect(slugOf("1 Samuel")).toBe("1-samuel");
    expect(slugOf("Cantico dei Cantici")).toBe("cantico-dei-cantici");
    expect(slugOf("Song of Songs / Canticles")).toBe("song-of-songs-canticles");
    expect(slugOf("Sirach (Ben Sira)'s")).toBe("sirach-ben-sira-s");
  });

  it("aNameWithNoLatinLettersFallsBackToTheBookNumber", () => {
    const books = [{ bookNum: 1, name: "Γένεσις" }];
    expect(slugFor(books[0], books)).toBe("book-1");
  });

  it("twoDifferentNonLatinNamesGetDistinctSlugs", () => {
    const books = [{ bookNum: 1, name: "Γένεσις" }, { bookNum: 2, name: "Ἔξοδος" }];
    expect(books.map((b) => slugFor(b, books))).toEqual(["book-1", "book-2"]);
  });

  it("collidingSlugsAreSuffixedWithTheBookNumber", () => {
    const books = [{ bookNum: 1, name: "Genesis" }, { bookNum: 9, name: "1 Samuel" }, { bookNum: 10, name: "1. Samuel" }];
    expect(books.map((b) => slugFor(b, books))).toEqual(["genesis", "1-samuel-9", "1-samuel-10"]);
  });
});

describe("bookBySlug", () => {
  const index = { sigla: "X", books: [{ bookNum: 1, name: "Génesis", abbrev: "Gn", chapters: 50, versesPerChapter: [] }] };
  it("findsAndMissesBooks", () => {
    expect(bookBySlug(index, "genesis")?.abbrev).toBe("Gn");
    expect(bookBySlug(index, "exodus")).toBeUndefined();
  });

  it("reachesEveryBookOfAnEditionWithNonLatinOrCollidingNames", () => {
    const book = (bookNum: number, name: string) => ({ bookNum, name, abbrev: `B${bookNum}`, chapters: 1, versesPerChapter: [1] });
    const greek = { sigla: "G", books: [book(1, "Γένεσις"), book(2, "Ἔξοδος"), book(9, "Samuel"), book(10, "Samuel")] };
    for (const b of greek.books) expect(bookBySlug(greek, slugFor(b, greek.books))?.bookNum).toBe(b.bookNum);
    expect(bookBySlug(greek, "samuel")).toBeUndefined();
  });
});

describe("getEditions", () => {
  it("parsesTheFullnameField", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({
      validversions: ["DRB", "BARE"],
      copyrightversions: ["DRB"],
      validversions_fullname: { DRB: "Douay–Rheims Challoner Revision|1752|en|1|CATHOLIC|Some Holder|First line.\nSecond | line.", BARE: "Bare" },
    })));
    expect(await getEditions()).toEqual([
      { sigla: "DRB", fullname: "Douay–Rheims Challoner Revision", year: "1752", language: "en", canon: "CATHOLIC", copyrightHolder: "Some Holder", notes: "First line.\nSecond | line.", copyright: true, liturgical: false },
      { sigla: "BARE", fullname: "Bare", year: "", language: "", canon: "", copyrightHolder: "", notes: "", copyright: false, liturgical: false },
    ]);
  });

  it("marksTheEditionsListedAsLiturgical", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({
      validversions: ["CEI2008", "LUZZI"],
      copyrightversions: ["CEI2008"],
      liturgicalversions: ["CEI2008"],
      validversions_fullname: { CEI2008: "Synthetic CEI|2008|it|1|CATHOLIC|Holder|", LUZZI: "Synthetic Luzzi|1924|it|1|PROTESTANT||" },
    })));
    const editions = await getEditions();
    expect(editions.map((e) => [e.sigla, e.liturgical, e.canon])).toEqual([["CEI2008", true, "CATHOLIC"], ["LUZZI", false, "PROTESTANT"]]);
  });

  it("treatsAMissingOrMalformedLiturgicalListAsNoLiturgicalEditions", async () => {
    for (const extra of [{}, { liturgicalversions: "CEI2008" }, { liturgicalversions: null }, { liturgicalversions: ["CEI2008", null] }]) {
      vi.stubGlobal("fetch", vi.fn(async () => json({ validversions: ["CEI2008"], validversions_fullname: { CEI2008: "Synthetic|2008|it|1|CATHOLIC||" }, ...extra })));
      expect((await getEditions())[0].liturgical).toBe(false);
    }
  });
});

describe("getApiVersion", () => {
  const withHeader = (value?: string) =>
    vi.fn(async () => new Response(JSON.stringify({ validversions: [] }), {
      status: 200,
      headers: { "content-type": "application/json", ...(value !== undefined && { "X-BibleGet-Version": value }) },
    }));

  it("readsTheHeaderOfTheCachedEditionsMetadataRequest", async () => {
    const fn = withHeader("v3.0.1-412-g892935b");
    vi.stubGlobal("fetch", fn);
    expect(await getApiVersion()).toBe("v3.0.1-412-g892935b");
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit & { next?: { revalidate: number } }];
    expect(url).toBe("https://api.test/dev/metadata/bibleversions");
    expect(init.next).toEqual({ revalidate: 86400 });
  });

  it("isNullWhenTheHeaderIsAbsentOrBlank", async () => {
    vi.stubGlobal("fetch", withHeader());
    expect(await getApiVersion()).toBeNull();
    vi.stubGlobal("fetch", withHeader("   "));
    expect(await getApiVersion()).toBeNull();
  });

  it("isNullWhenTheEndpointIsUnavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect(await getApiVersion()).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    expect(await getApiVersion()).toBeNull();
  });

  it("resolvesNullAfterThreeSecondsWhenTheEndpointHangs", async () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn((_url: string, _init?: RequestInit) => new Promise<Response>(() => {}));
      vi.stubGlobal("fetch", fn);
      let settled: string | null | undefined;
      void getApiVersion().then((v) => (settled = v));
      await vi.advanceTimersByTimeAsync(2999);
      expect(settled).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      expect(settled).toBeNull();
      expect(fn.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cutsAnOverlongValue", async () => {
    vi.stubGlobal("fetch", withHeader("v".repeat(200)));
    expect(await getApiVersion()).toBe("v".repeat(64));
  });
});
