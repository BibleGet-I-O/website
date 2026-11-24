import { describe, it, expect, vi } from "vitest";
import type { Note, VerseRow } from "@/lib/types";
import { chapterNotes, markerDomId, noteDomId, noteRuns } from "@/lib/notes";

vi.mock("server-only", () => ({}));
const { withNoteLinks } = await import("@/lib/note-links");

const note = (id: string, extra: Partial<Note> = {}): Note => ({
  id, edition: id.split(":")[0], kind: "footnote", marker: "*", label: null, title: null, body: "b", refs: [], ...extra,
});
const row = (chapter: number, verse: number, notes: Note[] = []): VerseRow => ({
  chapter, verse, label: null, printedChapter: null, text: "t", titles: [],
  ...(notes.length && { notes: notes.map((n) => ({ note: n, field: "text" as const, position: 0 })) }),
});

describe("notes", () => {
  it("domIdsAreSafe", () => {
    expect(noteDomId("NABRE:19023001-1")).toBe("note-NABRE-19023001-1");
    expect(markerDomId("NABRE:19023001-1", { chapter: 23, verse: 1, segment: "a" })).toBe("m-NABRE-19023001-1-v23.1a");
  });

  it("esthersHebrewRowHasItsOwnMarkerId", () => {
    // Both texts on one page: the same note on the Greek and the Hebrew 1:1.
    const at = { chapter: 1, verse: 1 };
    expect(markerDomId("NABRE:1", { ...at, tradition: "HEBREW" })).toBe("m-NABRE-1-v1.1-hebrew");
    expect(markerDomId("NABRE:1", at)).toBe("m-NABRE-1-v1.1");
  });

  it("aNoteMarkedTwiceIsListedOnce", () => {
    const a = note("NABRE:1"), b = note("NABRE:2");
    const out = chapterNotes([row(1, 1, [a]), row(1, 2, [b, a]), row(1, 3)]);
    expect(out.map((x) => [x.note.id, x.first])).toEqual([["NABRE:1", "m-NABRE-1-v1.1"], ["NABRE:2", "m-NABRE-2-v1.2"]]);
  });

  it("noteRunsCutTheBodyAtItsCitationsKeepingTheTags", () => {
    // "See <i>Jn</i> 1:3; Gn 2." with citations "Jn 1:3" (code points 4-16, tags included) and "Gn 2" (18-22).
    const body = "See <i>Jn</i> 1:3; Gn 2.";
    expect(noteRuns(body, [{ span: [4, 17] }, { span: [19, 23] }])).toEqual([
      { text: "See ", i: false, b: false, sm: false },
      { text: "Jn", i: true, b: false, sm: false, ref: 0 },
      { text: " 1:3", i: false, b: false, sm: false, ref: 0 },
      { text: "; ", i: false, b: false, sm: false },
      { text: "Gn 2", i: false, b: false, sm: false, ref: 1 },
      { text: ".", i: false, b: false, sm: false },
    ]);
  });

  it("otherTagsStayLiteralAndSmallCapsAreKept", () => {
    expect(noteRuns("the L<sm>ORD</sm> <x>", [])).toEqual([
      { text: "the L", i: false, b: false, sm: false },
      { text: "ORD", i: false, b: false, sm: true },
      { text: " <x>", i: false, b: false, sm: false },
    ]);
  });

  it("aCitationIntoAnotherEditionLinksThereWithItsName", () => {
    const cei = { sigla: "CEI2008", books: [{ bookNum: 28, name: "Siracide", abbrev: "Sir", chapters: 51, versesPerChapter: [] }] };
    const nv = { sigla: "NVBSE", books: [{ bookNum: 28, name: "Ecclesiasticus", abbrev: "Sir", chapters: 51, versesPerChapter: [] }] };
    const cites = note("CEI2008:52098", { refs: [
      { start: { book: 28, chapter: 24, verse: 1, segment: "b", printedChapter: null }, end: null, span: [0, 5], edition: "NVBSE" },
      { start: { book: 28, chapter: 24, verse: 3, segment: null, printedChapter: null }, end: null, span: [6, 9] },
    ] });
    const editions = {
      CEI2008: { index: cei, base: "/it/read/cei2008", query: "?with=NVBSE" },
      NVBSE: { index: nv, base: "/it/read/nvbse", query: "?with=CEI2008", name: "Nova Vulgata" },
    };
    const [r] = withNoteLinks([row(24, 1, [cites])], "CEI2008", (s) => editions[s as keyof typeof editions]);
    expect(r.notes![0].note.refs.map((x) => [x.href, x.editionName])).toEqual([
      ["/it/read/nvbse/ecclesiasticus/24?with=CEI2008#v24.1b", "Nova Vulgata"],
      ["/it/read/cei2008/siracide/24?with=NVBSE#v24.3", undefined],
    ]);
  });

  it("citationLinksToThePrintedChapter", () => {
    const index = { sigla: "NABRE", books: [{ bookNum: 27, name: "Wisdom", abbrev: "Wis", chapters: 19, versesPerChapter: [] }] };
    const cites = note("NABRE:9", { kind: "crossref", refs: [
      { start: { book: 27, chapter: 12, verse: 1, segment: null, printedChapter: 11 }, end: null, span: [0, 4] },
      { start: { book: 27, chapter: 3, verse: null, segment: null, printedChapter: null }, end: null, span: [5, 8] },
      { start: { book: 99, chapter: 1, verse: 1, segment: null, printedChapter: null }, end: null, span: [9, 12] },
    ] });
    const [r] = withNoteLinks([row(1, 1, [cites])], "NABRE", () => ({ index, base: "/en/read/nabre", query: "?with=VGCL" }));
    expect(r.notes![0].note.refs.map((x) => x.href)).toEqual([
      "/en/read/nabre/wisdom/11?with=VGCL#v12.1",
      "/en/read/nabre/wisdom/3?with=VGCL",
      undefined,
    ]);
  });
});
