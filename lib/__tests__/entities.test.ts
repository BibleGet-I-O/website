import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { byLetter, compactRefs, description, displayName, fold, getEntityIndex, otherName, showsWikidata, toEntity, type Entity } from "@/lib/entities";
import type { Book } from "@/lib/types";

const entity = (extra: Partial<Entity> = {}): Entity => ({
  id: "bpers:x", kind: "individual", names: { la: "Isaac", it: "Isacco", en: "Isaac" }, description: { it: "figlio di Abramo", en: "son of Abraham" },
  qid: "Q1", qidStatus: "reviewed", uncertain: false, refs: [], ...extra,
});
const book = (bookNum: number, name: string, abbrev: string): Book => ({ bookNum, name, abbrev, chapters: 50, versesPerChapter: [], prologue: 0 });
const BOOKS = [book(1, "Genesis", "Gn"), book(19, "Esther", "Est"), book(27, "Wisdom", "Wis")];

describe("an edition's index of persons, places and events", () => {
  it("readsTheEndpointsEntriesAndDropsMalformedOnes", () => {
    expect(toEntity({ id: "bpers:x", kind: "individual", names: { la: "Isaac" }, description: { en: "son" }, qid: null, qid_status: "auto", uncertain: true, refs: [[1, 21, 3, null, null], [19, 1, 1, "a", "GREEK"], [27, 12, 1, null, null, "12:1", 11]] })).toEqual({
      id: "bpers:x", kind: "individual", names: { la: "Isaac" }, description: { en: "son" }, qid: null, qidStatus: "auto", uncertain: true,
      refs: [
        { book: 1, chapter: 21, verse: 3, segment: null, tradition: null, label: null, printedChapter: null },
        { book: 19, chapter: 1, verse: 1, segment: "a", tradition: "GREEK", label: null, printedChapter: null },
        { book: 27, chapter: 12, verse: 1, segment: null, tradition: null, label: "12:1", printedChapter: 11 },
      ],
    });
    expect(toEntity({ id: 3 })).toBeNull();
    expect(toEntity({ id: "bpers:y", kind: "k", names: {}, description: {}, qid: null, qid_status: null, uncertain: false, refs: [[1, "x"]] })?.refs).toEqual([]);
  });

  it("picksTheNameInTheEditionsLanguage", () => {
    const e = entity();
    expect(displayName(e, "la")).toBe("Isaac");
    expect(displayName(e, "it")).toBe("Isacco");
    expect(displayName(e, "en")).toBe("Isaac");
    expect(displayName(e, "es")).toBe("Isaac");
    expect(displayName(entity({ names: { la: "", it: "Terzi", en: "Thirds" } }), "la")).toBe("Thirds");
    expect(displayName(entity({ names: { la: "", it: "Terzi" } }), "la")).toBe("Terzi");
    expect(otherName(e, "la", "it")).toBe("Isacco");
    expect(otherName(e, "la", "en")).toBeNull(); // the same as the displayed name
    expect(otherName(e, "la", "fr")).toBeNull();
    expect(description(e, "it")).toBe("figlio di Abramo");
    expect(description(e, "de")).toBe("son of Abraham");
    expect(description(entity({ description: {} }), "en")).toBeNull();
  });

  it("showsWikidataOnlyForReviewedOrAdjudicatedItems", () => {
    expect(showsWikidata(entity({ qidStatus: "reviewed" }))).toBe(true);
    expect(showsWikidata(entity({ qidStatus: "adjudicated" }))).toBe(true);
    expect(showsWikidata(entity({ qidStatus: "auto" }))).toBe(false);
    expect(showsWikidata(entity({ qid: null, qidStatus: "reviewed" }))).toBe(false);
  });

  it("filesAccentedNamesUnderTheirBaseLetter", () => {
    expect(fold("Ìsacco")).toBe("isacco");
    expect(fold("ʾEl")).toBe("el");
    const letters = byLetter([
      entity({ id: "b", names: { it: "Abanà" } }), entity({ id: "a", names: { it: "Abana" } }),
      entity({ id: "c", names: { it: "Ìsacco" } }), entity({ id: "d", names: { it: "ʾEl" } }),
    ], "it");
    expect([...letters.keys()]).toEqual(["A", "E", "I"]);
    expect(letters.get("A")!.map((e) => e.id)).toEqual(["a", "b"]); // same folded name: id order
  });

  it("compactsConsecutiveVersesAndLinksThem", () => {
    const r = (chapter: number, verse: number) => ({ book: 1, chapter, verse, segment: null, tradition: null, label: null, printedChapter: null });
    const groups = compactRefs([r(11, 26), r(11, 27), r(11, 29), r(12, 1)], BOOKS, "NVBSE");
    expect(groups.map((g) => [g.book, g.parts.map((p) => p.label)])).toEqual([["Gn", ["11:26–27", "29", "12:1"]]]);
    expect(groups[0].parts[0].href).toBe("/read/nvbse/genesis/11#v11.26");
    expect(groups[0].parts[1].href).toBe("/read/nvbse/genesis/11#v11.29");
  });

  it("showsAndLinksAVerseAsTheEditionPrintsIt", () => {
    const v = (chapter: number, verse: number, label: string | null, printedChapter: number | null, book = 19) =>
      ({ book, chapter, verse, segment: null, tradition: "GREEK" as const, label, printedChapter });
    // NABRE's Greek Esther prints letters: 8:12v is "E:21"; a labelled verse is never merged into a range.
    const [est] = compactRefs([v(8, 12, "E:20", null), v(8, 13, "E:21", null)], BOOKS, "NABRE");
    expect(est.parts.map((p) => p.label)).toEqual(["E:20", "E:21"]);
    expect(est.parts[1].href).toBe("/read/nabre/esther/8?tradition=GREEK#v8.13");
    // NABRE Wis 12:1 is printed at the end of chapter 11: the link opens chapter 11, at the verse's own anchor.
    const [wis] = compactRefs([{ book: 27, chapter: 12, verse: 1, segment: null, tradition: null, label: "12:1", printedChapter: 11 }], BOOKS, "NABRE");
    expect(wis.parts).toEqual([{ label: "12:1", href: "/read/nabre/wisdom/11#v12.1" }]);
  });

  it("linksAGreekEstherVerseWithItsTradition", () => {
    const [g] = compactRefs([{ book: 19, chapter: 1, verse: 1, segment: "a", tradition: "GREEK", label: null, printedChapter: null }], BOOKS, "NVBSE");
    expect(g.parts).toEqual([{ label: "1:1a", href: "/read/nvbse/esther/1?tradition=GREEK#v1.1a" }]);
  });
});

describe("getEntityIndex", () => {
  const json = (body: unknown, status = 200, type = "application/json") => new Response(JSON.stringify(body), { status, headers: { "content-type": type } });
  beforeEach(() => {
    process.env.BIBLEGET_API_URL = "https://api.test/dev";
    process.env.BIBLEGET_READ_KEY = "read-key";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("asksForTheEditionsIndexOfOneTypeAndKeepsTheWellFormedEntries", async () => {
    const fn = vi.fn(async () => json({ edition: "NVBSE", type: "place", entries: [
      { id: "bplace:a", kind: "city", names: { la: "A" }, description: {}, qid: null, qid_status: null, uncertain: false, refs: [[1, 2, 3, null, null]] },
      { id: 7 },
    ] }));
    vi.stubGlobal("fetch", fn);
    const entries = await getEntityIndex("NVBSE", "place");
    expect(entries.map((e) => e.id)).toEqual(["bplace:a"]);
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit & { next?: unknown }];
    expect(url).toBe("https://api.test/dev/metadata/entities?version=NVBSE&type=place");
    expect(init.headers).toMatchObject({ "X-Api-Key": "read-key" });
    expect(init.next).toEqual({ revalidate: 86400 });
  });

  it("answersAnEmptyIndexWhenTheEndpointCannotSay", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ title: "Not Found" }, 404, "application/problem+json")));
    expect(await getEntityIndex("NVBSE", "person")).toEqual([]);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("network"); }));
    expect(await getEntityIndex("NVBSE", "person")).toEqual([]);
  });
});
