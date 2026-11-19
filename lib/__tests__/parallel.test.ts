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
    const rows = buildRows(vgcl9, nabre10, PSALMS);
    const r = rows.find((x) => x.a?.verse === 22)!;
    expect(r.b).toMatchObject({ chapter: 10, verse: 1 });
    expect(rows).toHaveLength(39);
    expect(rows.filter((x) => x.a && x.b)).toHaveLength(18);
  });

  it("insertsUnmatchedSecondRowsAfterTheirPrecedingMatch", () => {
    const a = [row(2, 1, "2:1"), row(2, 2, "2:2")];
    const b = [row(2, 1, "2:1"), row(2, 15, "2:1a"), row(2, 2, "2:2"), row(2, 3, "2:3")];
    expect(buildRows(a, b, PSALMS).map((r) => r.key)).toEqual(["2:1", "2:1a", "2:2", "2:3"]);
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
  const rawIndex = (sigla: string, abbrev: string, verses: number[]) => ({
    indexes: { [sigla]: { abbreviations: [abbrev], biblebooks: ["Psalms"], chapter_limit: [verses.length], verse_limit: [verses], book_num: [PSALMS] } },
  });
  const raw = (chapter: number, verse: number, hebrew: string) => ({ chapter, verse, text: "t", psalm_hebrew: hebrew });

  function mockFetch(sigla: string, abbrev: string, quote: (url: URL) => object[]) {
    const fn = vi.fn(async (url: string | URL | Request) => {
      const u = new URL(String(url));
      if (u.pathname.endsWith("/metadata/versionindex")) return json(rawIndex(sigla, abbrev, Array(150).fill(20)));
      return json({ results: quote(u), errors: [] });
    });
    vi.stubGlobal("fetch", fn);
    return () => fn.mock.calls.map((c) => new URL(String(c[0]))).filter((u) => u.pathname.endsWith("/quote"));
  }
  const nabreIndex = idx("NABRE", [book(PSALMS, "Ps", Array(150).fill(20))]);
  const vgclIndex = idx("VGCL", [book(PSALMS, "Psal", Array(150).fill(20))]);

  beforeEach(() => {
    process.env.BIBLEGET_API_URL = "https://api.test/dev";
    process.env.BIBLEGET_READ_KEY = "read-key";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("vulgateMainEditionFetchesBothHebrewPsalms", async () => {
    const quotes = mockFetch("NABRE", "Ps", (u) => {
      const ch = Number(u.searchParams.get("query")!.replace("Ps", ""));
      return [raw(ch, 1, `${ch}:1`)];
    });
    const second = await loadSecond({
      mainIndex: vgclIndex, bookNum: PSALMS, chapter: 9, mainRows: vgcl9, withSigla: "NABRE", access: "visitor",
    });
    const urls = quotes();
    expect(urls.map((u) => u.searchParams.get("query"))).toEqual(["Ps9", "Ps10"]);
    expect(urls.every((u) => u.searchParams.get("version") === "NABRE")).toBe(true);
    expect(second.mode).toBe("aligned");
    expect(second.rows.map((r) => r.psalmHebrew)).toEqual(["9:1", "10:1"]);
  });

  it("hebrewMainEditionFetchesTheVulgateSecondWithHebrewNumbering", async () => {
    const quotes = mockFetch("VGCL", "Psal", () => [raw(9, 22, "10:1"), raw(9, 23, "10:2")]);
    const nabre10 = [row(10, 1, "10:1"), row(10, 2, "10:2")];
    const second = await loadSecond({
      mainIndex: nabreIndex, bookNum: PSALMS, chapter: 10, mainRows: nabre10, withSigla: "VGCL", access: "visitor",
    });
    const [u] = quotes();
    expect(quotes()).toHaveLength(1);
    expect(u.searchParams.get("query")).toBe("Psal10");
    expect(u.searchParams.get("version")).toBe("VGCL");
    expect(u.searchParams.has("numbering")).toBe(false);
    expect(second.rows.map((r) => [r.chapter, r.verse])).toEqual([[9, 22], [9, 23]]);
  });

  it("dropsSecondRowsTheMainEditionPrintsInItsNeighbouringChapters", async () => {
    // VGCL 114 is Hebrew 116:1-9; VGCL 115 continues with Hebrew 116:10-19.
    mockFetch("NABRE", "Ps", () => Array.from({ length: 19 }, (_, i) => raw(116, i + 1, `116:${i + 1}`)));
    const vgcl114 = Array.from({ length: 9 }, (_, i) => row(114, i + 1, `116:${i + 1}`));
    const second = await loadSecond({
      mainIndex: vgclIndex, bookNum: PSALMS, chapter: 114, mainRows: vgcl114, withSigla: "NABRE", access: "visitor",
      nextFirst: [row(115, 1, "116:10")],
    });
    expect(second.rows.map((r) => r.verse)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const vgcl115 = Array.from({ length: 10 }, (_, i) => row(115, i + 1, `116:${i + 10}`));
    const later = await loadSecond({
      mainIndex: vgclIndex, bookNum: PSALMS, chapter: 115, mainRows: vgcl115, withSigla: "NABRE", access: "visitor",
      prevLast: [row(114, 9, "116:9")],
    });
    expect(later.rows.map((r) => r.verse)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });

  it("aSecondEditionWithoutTheBookIsMissing", async () => {
    mockFetch("NABRE", "Ps", () => []);
    const second = await loadSecond({
      mainIndex: idx("VGCL", [book(17, "Tob", [22])]), bookNum: 17, chapter: 1, mainRows: [row(1, 1)], withSigla: "NABRE", access: "visitor",
    });
    expect(second).toEqual({ mode: "missing", rows: [] });
  });
});
