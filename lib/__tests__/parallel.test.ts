import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Book, EditionIndex, VerseRow } from "../types";

vi.mock("server-only", () => ({}));
const { alignKey, buildRows, pairingMode, psalmChapters, PSALMS } = await import("../parallel");
const { loadSecond } = await import("../interlinear");

const row = (chapter: number, verse: number, psalmHebrew?: string): VerseRow => ({
  chapter, verse, label: null, printedChapter: null, text: `${chapter}:${verse}`, titles: [],
  ...(psalmHebrew && { psalmHebrew }),
});
const book = (bookNum: number, abbrev: string, versesPerChapter: number[]): Book => ({
  bookNum, name: abbrev, abbrev, chapters: versesPerChapter.length, versesPerChapter,
});
const idx = (sigla: string, books: Book[]): EditionIndex => ({ sigla, books });

// VGCL Psalm 9 as the endpoint returns it: 9:1-21 are Hebrew 9:1-21, 9:22-39 are Hebrew 10:1-18.
const vgcl9 = [
  ...Array.from({ length: 21 }, (_, i) => row(9, i + 1, `9:${i + 1}`)),
  ...Array.from({ length: 18 }, (_, i) => row(9, 22 + i, `10:${i + 1}`)),
];

describe("alignment", () => {
  it("alignsPsalmsByHebrewReference", () => {
    expect(alignKey(row(9, 22, "10:1"), PSALMS)).toBe("10:1");
    expect(alignKey(row(5, 3), 47)).toBe("5:3");
    const nabre10 = Array.from({ length: 18 }, (_, i) => row(10, i + 1, `10:${i + 1}`));
    const rows = buildRows(vgcl9, [nabre10], PSALMS);
    const r = rows.find((x) => x.a?.verse === 22)!;
    expect(r.others[0]).toMatchObject({ chapter: 10, verse: 1 });
    expect(rows).toHaveLength(39);
    expect(rows.filter((x) => x.a && x.others[0])).toHaveLength(18);
  });

  it("insertsUnmatchedSecondRowsAfterTheirPrecedingMatch", () => {
    const a = [row(2, 1, "2:1"), row(2, 2, "2:2")];
    const b = [row(2, 1, "2:1"), row(2, 15, "2:1a"), row(2, 2, "2:2"), row(2, 3, "2:3")];
    expect(buildRows(a, [b], PSALMS).map((r) => r.key)).toEqual(["2:1", "2:1a", "2:2", "2:3"]);
  });

  it("twoComparedEditionsShareTheRowOfAVerseTheMainLacks", () => {
    // NVBSE omits Mt 17:21; VGCL and DRB have it (synthetic text).
    const nvbse = [row(17, 20), row(17, 22)];
    const vgcl = [row(17, 20), row(17, 21), row(17, 22)];
    const drb = [row(17, 20), row(17, 21), row(17, 22)];
    const rows = buildRows(nvbse, [vgcl, drb], 47);
    expect(rows.map((r) => r.key)).toEqual(["17:20", "17:21", "17:22"]);
    expect(rows[1].a).toBeUndefined();
    expect(rows[1].others.map((x) => x?.verse)).toEqual([21, 21]);
    expect(rows.every((r) => r.others.length === 2)).toBe(true);
  });

  it("aThirdEditionAlignsAgainstTheMainLikeTheSecond", () => {
    const a = [row(5, 1), row(5, 2)];
    const b = [row(5, 1), row(5, 2)];
    const c = [row(5, 1), row(5, 2), row(5, 3)];
    const rows = buildRows(a, [b, c], 47);
    expect(rows.map((r) => [r.a?.verse, r.others[0]?.verse, r.others[1]?.verse])).toEqual([[1, 1, 1], [2, 2, 2], [undefined, undefined, 3]]);
  });

  it("lettersKeepVersesApart", () => {
    // Esther 1:1a-1k and 1:1 are different verses: each pairs with its own counterpart.
    const lettered = (seg: string | null) => ({ ...row(1, 1), segment: seg });
    expect(alignKey(lettered("a"), 19)).toBe("1:1a");
    expect(alignKey(lettered(null), 19)).toBe("1:1");
    const rows = buildRows([lettered("a"), lettered("b"), lettered(null)], [[lettered("a"), lettered("b"), lettered(null)]], 19);
    expect(rows.map((r) => [r.key, r.a?.segment ?? null, r.others[0]?.segment ?? null])).toEqual([["1:1a", "a", "a"], ["1:1b", "b", "b"], ["1:1", null, null]]);
  });

    it("psalmChaptersAreTheDistinctHebrewPsalmsInOrder", () => {
    expect(psalmChapters(vgcl9)).toEqual([9, 10]);
    expect(psalmChapters([row(10, 1, "10:1")])).toEqual([10]);
  });

  it("differentVerseCountsOutsidePsalmsUseWholeChapter", () => {
    // Joel: NABRE 4 chapters (3 has 5 verses), VGCL 3 chapters (3 has 21 verses).
    const nabre = idx("NABRE", [book(32, "Joel", [20, 27, 5, 21])]);
    const vgcl = idx("VGCL", [book(32, "Joel", [20, 32, 21])]);
    expect(pairingMode(nabre, vgcl, 32, 3)).toBe("whole-chapter");
    expect(pairingMode(nabre, vgcl, 32, 4)).toBe("whole-chapter");
    expect(pairingMode(nabre, vgcl, 32, 1)).toBe("aligned");
  });

  it("thePrologueAlignsOnlyWhereBothEditionsPrintIt", () => {
    const sir = (prologue: number) => ({ ...book(28, "Sir", [30, 18]), prologue });
    const nabre = idx("NABRE", [sir(1)]);
    expect(pairingMode(nabre, idx("CEI2008", [sir(1)]), 28, 0)).toBe("aligned");
    expect(pairingMode(nabre, idx("DRB", [sir(0)]), 28, 0)).toBe("whole-chapter");
  });

  it("equalCountsAlign", () => {
    const drb = idx("DRB", [book(47, "Matt", [25, 23, 17, 25, 48])]);
    const vgcl = idx("VGCL", [book(47, "Mt", [25, 23, 17, 25, 48])]);
    expect(pairingMode(drb, vgcl, 47, 5)).toBe("aligned");
    // Psalms are always aligned by the Hebrew reference, whatever the counts.
    const a = idx("NABRE", [book(PSALMS, "Ps", [6, 12, 9, 9, 13, 11, 18, 10, 21])]);
    const b = idx("VGCL", [book(PSALMS, "Psal", [6, 13, 9, 9, 13, 11, 18, 10, 39])]);
    expect(pairingMode(a, b, PSALMS, 9)).toBe("aligned");
  });
});

describe("loadSecond", () => {
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  type RawBook = { abbrev: string; bookNum: number; verses: number[]; name?: string };
  const rawIndex = (sigla: string, books: RawBook[]) => ({
    indexes: { [sigla]: {
      abbreviations: books.map((b) => b.abbrev), biblebooks: books.map((b) => b.name ?? b.abbrev),
      chapter_limit: books.map((b) => b.verses.length), verse_limit: books.map((b) => b.verses), book_num: books.map((b) => b.bookNum),
    } },
  });
  const raw = (chapter: number, verse: number, hebrew?: string) => ({ chapter, verse, text: "t", ...(hebrew && { psalm_hebrew: hebrew }) });
  const range = <T,>(n: number, f: (i: number) => T): T[] => Array.from({ length: n }, (_, i) => f(i));

  /** A fake endpoint: each edition's index, and its quote answers by version and query. */
  function mockFetch(indexes: Record<string, RawBook[]>, quote: (version: string, query: string, u: URL) => object[] | Response) {
    const fn = vi.fn(async (url: string | URL | Request) => {
      const u = new URL(String(url));
      if (u.pathname.endsWith("/metadata/versionindex")) {
        const v = u.searchParams.get("versions")!;
        return json(rawIndex(v, indexes[v] ?? []));
      }
      const r = quote(u.searchParams.get("version")!, u.searchParams.get("query")!, u);
      return r instanceof Response ? r : json({ results: r, errors: [] });
    });
    vi.stubGlobal("fetch", fn);
    return () => fn.mock.calls.map((c) => new URL(String(c[0]))).filter((u) => u.pathname.endsWith("/quote"));
  }
  const psalmsOf = (abbrev: string) => [{ abbrev, bookNum: PSALMS, verses: Array(150).fill(20) }];
  const nabreIndex = idx("NABRE", [book(PSALMS, "Ps", Array(150).fill(20))]);
  const vgclIndex = idx("VGCL", [book(PSALMS, "Psal", Array(150).fill(20))]);
  const drbIndex = idx("DRB", [book(PSALMS, "Psa", Array(150).fill(20))]);
  const main = (sigla: string, abbrev: string, mainIndex: EditionIndex) => ({ mainSigla: sigla, mainBookAbbrev: abbrev, mainIndex, access: "visitor" as const });

  beforeEach(() => {
    process.env.BIBLEGET_API_URL = "https://api.test/dev";
    process.env.BIBLEGET_READ_KEY = "read-key";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("anEditionWithoutThePrologueSaysSo", async () => {
    const quotes = mockFetch({ DRB: [{ abbrev: "Sir", bookNum: 28, verses: [30, 18] }] }, () => []);
    const nabre = idx("NABRE", [{ ...book(28, "Sir", [30, 18]), prologue: 1 }]);
    const second = await loadSecond({ ...main("NABRE", "Sir", nabre), bookNum: 28, chapter: 0, mainRows: [row(0, 1)], withSigla: "DRB" });
    expect(second).toEqual({ mode: "missing", reason: "prologue" });
    expect(quotes()).toHaveLength(0);
  });

  it("vulgateMainEditionFetchesBothHebrewPsalms", async () => {
    const quotes = mockFetch({ NABRE: psalmsOf("Ps"), VGCL: psalmsOf("Psal") }, (v, q) => {
      if (v === "VGCL") return vgcl9.map((r) => raw(r.chapter, r.verse, r.psalmHebrew));
      const ch = Number(q.replace("Ps", ""));
      return [raw(ch, 1, `${ch}:1`)];
    });
    const second = await loadSecond({ ...main("VGCL", "Psal", vgclIndex), bookNum: PSALMS, chapter: 9, mainRows: vgcl9, withSigla: "NABRE" });
    const urls = quotes().filter((u) => u.searchParams.get("version") === "NABRE");
    expect(urls.map((u) => u.searchParams.get("query"))).toEqual(["Ps9", "Ps10"]);
    expect(urls.every((u) => !u.searchParams.has("numbering"))).toBe(true);
    expect(second).toMatchObject({ mode: "aligned", truncated: false });
    expect(second.mode === "aligned" && second.rows.map((r) => r.psalmHebrew)).toEqual(["9:1", "10:1"]);
  });

  it("hebrewMainEditionFetchesTheVulgateSecondWithHebrewNumbering", async () => {
    const nabre10 = [row(10, 1, "10:1"), row(10, 2, "10:2")];
    const quotes = mockFetch({ NABRE: psalmsOf("Ps"), VGCL: psalmsOf("Psal") }, (v) =>
      v === "VGCL" ? [raw(9, 22, "10:1"), raw(9, 23, "10:2")] : [raw(10, 1, "10:1"), raw(10, 2, "10:2")]);
    const second = await loadSecond({ ...main("NABRE", "Ps", nabreIndex), bookNum: PSALMS, chapter: 10, mainRows: nabre10, withSigla: "VGCL" });
    const vg = quotes().filter((u) => u.searchParams.get("version") === "VGCL");
    expect(vg).toHaveLength(1);
    expect(vg[0].searchParams.get("query")).toBe("Psal10");
    expect(vg[0].searchParams.has("numbering")).toBe(false);
    expect(second.mode === "aligned" && second.rows.map((r) => [r.chapter, r.verse])).toEqual([[9, 22], [9, 23]]);
  });

  // DRB 114 is Hebrew 116:1-9 and DRB 115 is Hebrew 116:10-19, numbered 10-19 (it has no verse 1).
  const drbHeb116 = [...range(9, (i) => raw(114, i + 1, `116:${i + 1}`)), ...range(10, (i) => raw(115, i + 10, `116:${i + 10}`))];
  // VGCL 114 is Hebrew 116:1-9 and VGCL 115:1-10 is Hebrew 116:10-19.
  const vgclHeb116 = [...range(9, (i) => raw(114, i + 1, `116:${i + 1}`)), ...range(10, (i) => raw(115, i + 1, `116:${i + 10}`))];
  const toRows = (xs: ReturnType<typeof raw>[], chapter: number) =>
    xs.filter((x) => x.chapter === chapter).map((x) => row(x.chapter, x.verse, x.psalm_hebrew));

  it("keepsOnlyTheSecondRowsOfAPsalmTheVulgateMainEditionPrintsInThisChapter", async () => {
    for (const [sigla, abbrev, index, heb116] of [["DRB", "Psa", drbIndex, drbHeb116], ["VGCL", "Psal", vgclIndex, vgclHeb116]] as const) {
      const quotes = mockFetch({ [sigla]: psalmsOf(abbrev), NABRE: psalmsOf("Ps") }, (v) =>
        v === sigla ? heb116 : range(19, (i) => raw(116, i + 1, `116:${i + 1}`)));
      for (const [chapter, expected] of [[114, range(9, (i) => i + 1)], [115, range(10, (i) => i + 10)]] as const) {
        const second = await loadSecond({ ...main(sigla, abbrev, index), bookNum: PSALMS, chapter, mainRows: toRows(heb116, chapter), withSigla: "NABRE" });
        expect(second.mode === "aligned" && second.rows.map((r) => r.verse)).toEqual(expected);
      }
      // The main edition is asked for the same Hebrew psalm, in Hebrew numbering.
      expect(quotes().some((u) => u.searchParams.get("version") === sigla && u.searchParams.get("query") === `${abbrev}116` && !u.searchParams.has("numbering"))).toBe(true);
    }
  });

  it("aCappedSecondEditionInHebrewModeIsTruncated", async () => {
    // NABRE Ps 18 (Hebrew numbering) has 51 verses; the visitor's answer stops at 30.
    const nabre18 = range(51, (i) => row(18, i + 1, `18:${i + 1}`));
    mockFetch({ NABRE: psalmsOf("Ps"), CEI2008: psalmsOf("Sal") }, (v) =>
      v === "CEI2008" ? range(30, (i) => raw(18, i + 1, `18:${i + 1}`)) : nabre18.map((r) => raw(18, r.verse, r.psalmHebrew)));
    const second = await loadSecond({ ...main("NABRE", "Ps", nabreIndex), bookNum: PSALMS, chapter: 18, mainRows: nabre18, withSigla: "CEI2008" });
    expect(second).toMatchObject({ mode: "aligned", truncated: true });
    // Exactly 30 rows where the main edition also ends there is the whole psalm, not a cap.
    const short = range(30, (i) => row(18, i + 1, `18:${i + 1}`));
    mockFetch({ NABRE: psalmsOf("Ps"), CEI2008: psalmsOf("Sal") }, () => range(30, (i) => raw(18, i + 1, `18:${i + 1}`)));
    expect(await loadSecond({ ...main("NABRE", "Ps", nabreIndex), bookNum: PSALMS, chapter: 18, mainRows: short, withSigla: "CEI2008" }))
      .toMatchObject({ truncated: false });
  });

  it("aCappedSecondEditionOutsidePsalmsIsTruncated", async () => {
    const drb = idx("DRB", [book(47, "Matt", [25, 23, 17, 25, 48])]);
    mockFetch({ NABRE: [{ abbrev: "Mt", bookNum: 47, verses: [25, 23, 17, 25, 48] }] }, () => range(30, (i) => raw(5, i + 1)));
    const second = await loadSecond({ ...main("DRB", "Matt", drb), bookNum: 47, chapter: 5, mainRows: [row(5, 1)], withSigla: "NABRE" });
    expect(second).toMatchObject({ mode: "aligned", truncated: true });
  });

  describe("a main verse printed in this chapter from another one", () => {
    // NABRE prints John 7:53 at the start of John 8; VGCL keeps it in its own chapter 7.
    const verses = [10, 10, 10, 10, 10, 10, 53, 3];
    const nabre = idx("NABRE", [book(50, "Jn", verses)]);
    const printedHere = (chapter: number, verse: number, label: string | null = null): VerseRow => ({ ...row(chapter, verse), printedChapter: 8, label });
    const queriesOf = (quotes: () => URL[]) => quotes().filter((u) => u.searchParams.get("version") === "VGCL").map((u) => u.searchParams.get("query"));

    it("isFetchedFromTheSecondEditionsOwnChapterAndPaired", async () => {
      const quotes = mockFetch({ VGCL: [{ abbrev: "Io", bookNum: 50, verses }] }, (_v, q) =>
        q === "Io7:53" ? [raw(7, 53)] : [raw(8, 1), raw(8, 2), raw(8, 3)]);
      const mainRows = [printedHere(7, 53), printedHere(7, 53, "53b"), row(8, 1), row(8, 2), row(8, 3)];
      const second = await loadSecond({ ...main("NABRE", "Jn", nabre), bookNum: 50, chapter: 8, mainRows, withSigla: "VGCL" });
      expect(second.mode).toBe("aligned");
      const rows = second.mode === "aligned" ? second.rows : [];
      expect(rows.map((r) => `${r.chapter}:${r.verse}`)).toEqual(["7:53", "8:1", "8:2", "8:3"]);
      expect(queriesOf(quotes).sort()).toEqual(["Io7:53", "Io8"]);
      expect(buildRows(mainRows, [rows], 50).filter((x) => x.a && x.others[0]).map((x) => x.key)).toEqual(["7:53", "8:1", "8:2", "8:3"]);
    });

    it("isNotDuplicatedWhenTheChapterAlreadyHasIt", async () => {
      const quotes = mockFetch({ VGCL: [{ abbrev: "Io", bookNum: 50, verses }] }, () => [raw(7, 53), raw(8, 1), raw(8, 2), raw(8, 3)]);
      const mainRows = [printedHere(7, 53), row(8, 1), row(8, 2), row(8, 3)];
      const second = await loadSecond({ ...main("NABRE", "Jn", nabre), bookNum: 50, chapter: 8, mainRows, withSigla: "VGCL" });
      expect(second.mode === "aligned" && second.rows.map((r) => `${r.chapter}:${r.verse}`)).toEqual(["7:53", "8:1", "8:2", "8:3"]);
      expect(queriesOf(quotes)).toEqual(["Io8"]);
    });
  });

  it("aSecondEditionWithoutTheBookIsMissing", async () => {
    mockFetch({ NABRE: psalmsOf("Ps") }, () => []);
    const second = await loadSecond({ ...main("VGCL", "Tob", idx("VGCL", [book(17, "Tob", [22])])), bookNum: 17, chapter: 1, mainRows: [row(1, 1)], withSigla: "NABRE" });
    expect(second).toEqual({ mode: "missing", reason: "book" });
  });

  it("aChapterBeyondTheSecondEditionsCountIsDividedDifferently", async () => {
    const nabre = idx("NABRE", [book(32, "Joel", [20, 27, 5, 21])]);
    const quotes = mockFetch({ VGCL: [{ abbrev: "Joel", bookNum: 32, verses: [20, 32, 21] }] }, () => []);
    const second = await loadSecond({ ...main("NABRE", "Joel", nabre), bookNum: 32, chapter: 4, mainRows: [row(4, 1)], withSigla: "VGCL" });
    expect(second).toMatchObject({ mode: "whole-chapter", rows: [], truncated: false });
    expect(quotes()).toHaveLength(0);
  });

  describe("Esther", () => {
    const both = { abbrev: "Est", bookNum: 19, verses: [...Array(10).fill(20), ...Array(10).fill(25)] };
    const vgclEsther = idx("VGCL", [book(19, "Esth", Array(16).fill(20))]);

    it("aVulgateChapterBeyondTenIsPrintedAsAdditionsInAnEditionWithBothTexts", async () => {
      mockFetch({ NABRE: [both] }, () => []);
      const second = await loadSecond({ ...main("VGCL", "Esth", vgclEsther), bookNum: 19, chapter: 12, mainRows: [row(12, 1)], withSigla: "NABRE" });
      expect(second).toEqual({ mode: "missing", reason: "esther-additions" });
    });

    it("passesTheTraditionOnlyToAnEditionWithBothTexts", async () => {
      const nabre = idx("NABRE", [{ ...book(19, "Est", Array(10).fill(20)), greekVersesPerChapter: Array(10).fill(25) }]);
      let quotes = mockFetch({ CEI2008: [both] }, () => range(20, (i) => raw(1, i + 1)));
      await loadSecond({ ...main("NABRE", "Est", nabre), bookNum: 19, chapter: 1, mainRows: [row(1, 1)], withSigla: "CEI2008", tradition: "HEBREW" });
      expect(quotes()[0].searchParams.get("text_tradition")).toBe("HEBREW");
      quotes = mockFetch({ VGCL: [{ abbrev: "Esth", bookNum: 19, verses: Array(16).fill(20) }] }, () => range(20, (i) => raw(1, i + 1)));
      const second = await loadSecond({ ...main("NABRE", "Est", nabre), bookNum: 19, chapter: 1, mainRows: [row(1, 1)], withSigla: "VGCL", tradition: "HEBREW" });
      expect(quotes()[0].searchParams.has("text_tradition")).toBe(false);
      expect(second.mode).toBe("aligned");
    });
  });

  it("anUnreachableSecondEditionIsUnavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const drb = idx("DRB", [book(47, "Matt", [25, 23, 17, 25, 48])]);
    mockFetch({ NABRE: [{ abbrev: "Mt", bookNum: 47, verses: [25, 23, 17, 25, 48] }] }, () => new Response("x", { status: 503 }));
    const second = await loadSecond({ ...main("DRB", "Matt", drb), bookNum: 47, chapter: 5, mainRows: [row(5, 1)], withSigla: "NABRE" });
    expect(second).toEqual({ mode: "unavailable" });
  });
});
