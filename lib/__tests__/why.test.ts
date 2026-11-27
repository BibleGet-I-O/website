import { describe, it, expect } from "vitest";
import { omittedAfter, printedElsewhere, psalmNote } from "@/lib/why";
import type { VerseRow } from "@/lib/types";

const row = (chapter: number, verse: number, extra: Partial<VerseRow> = {}): VerseRow => ({
  chapter, verse, label: null, printedChapter: null, text: "x", titles: [], ...extra,
});

describe("where the reader explains a difference", () => {
  it("printedElsewhereNotPsalmOffset", () => {
    expect(printedElsewhere(row(12, 1, { printedChapter: 11 }), 11)).toBe(true); // NABRE Wis 12:1 closing Wis 11
    expect(printedElsewhere(row(7, 53, { printedChapter: 8 }), 8)).toBe(true); // John 7:53 opening John 8
    expect(printedElsewhere(row(9, 22), 10)).toBe(false); // VGCL 9:22 beside NABRE Psalm 10
    expect(printedElsewhere(row(11, 5), 11)).toBe(false);
  });

  it("samePsalmNumberShowsNothing", () => {
    expect(psalmNote([row(23, 1, { psalmHebrew: "23:1" })], 23)).toBeNull();
    expect(psalmNote([row(1, 1)], 1)).toBeNull();
  });

  it("psalmNoteGivesTheOtherNumbering", () => {
    // VGCL 22 is Hebrew 23, verse for verse.
    expect(psalmNote([row(22, 1, { psalmHebrew: "23:1" }), row(22, 2, { psalmHebrew: "23:2" })], 22)).toBe("(23)");
    // VGCL 9 is Hebrew 9 and 10.
    expect(psalmNote([row(9, 1, { psalmHebrew: "9:1" }), row(9, 22, { psalmHebrew: "10:1" })], 9)).toBe("(9–10)");
    // VGCL 147 is Hebrew 147:12-20.
    expect(psalmNote([row(147, 1, { psalmHebrew: "147:12" }), row(147, 9, { psalmHebrew: "147:20" })], 147)).toBe("(147:12–20)");
    // VGCL 115 is Hebrew 116:10-19.
    expect(psalmNote([row(115, 1, { psalmHebrew: "116:10" }), row(115, 10, { psalmHebrew: "116:19" })], 115)).toBe("(116:10–19)");
  });

  it("findsTheNumbersAnEditionSkipsInsideAChapter", () => {
    // Nova Vulgata Acts 24: "(7)" between 6 and 8.
    expect(omittedAfter([row(24, 5), row(24, 6), row(24, 8)], 24)).toEqual(new Map([[1, [7, 7]]]));
    // Sir 9: one bracket holds two numbers, "(10. 11)".
    expect(omittedAfter([row(9, 9), row(9, 12)], 9)).toEqual(new Map([[0, [10, 11]]]));
    // A verse divided into parts is not a gap.
    expect(omittedAfter([row(3, 17, { segment: "a" }), row(3, 17, { segment: "b" }), row(3, 18)], 3).size).toBe(0);
  });

  it("findsNoOmissionWhereAChapterOnlyStartsLaterEndsSoonerOrReordersVerses", () => {
    // NABRE Wis 12 opens at 2 (12:1 closes Wis 11); NABRE Ps 2 ends at 11.
    expect(omittedAfter([row(12, 2), row(12, 3)], 12).size).toBe(0);
    // A verse of another chapter printed on this page does not open or close a gap.
    expect(omittedAfter([row(11, 26), row(12, 1, { printedChapter: 11 })], 11).size).toBe(0);
    expect(omittedAfter([row(7, 53, { printedChapter: 8 }), row(8, 1), row(8, 2)], 8).size).toBe(0);
    // Transposed verses: every number is printed somewhere in the chapter.
    expect(omittedAfter([row(1, 1), row(1, 2), row(1, 5), row(1, 6), row(1, 3), row(1, 4), row(1, 7)], 1).size).toBe(0);
    // Ez 40:42a, 43a, 42b, 43b.
    expect(omittedAfter([row(40, 41), row(40, 42), row(40, 43), row(40, 42), row(40, 43), row(40, 44)], 40).size).toBe(0);
  });
});
