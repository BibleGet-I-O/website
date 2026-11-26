import { describe, it, expect } from "vitest";
import { otherPsalmNumbers, printedElsewhere, psalmNote } from "@/lib/why";
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
    expect(otherPsalmNumbers([row(23, 1, { psalmHebrew: "23:1" })], 23)).toEqual([]);
    expect(otherPsalmNumbers([row(22, 1, { psalmHebrew: "23:1" }), row(22, 2, { psalmHebrew: "23:2" })], 22)).toEqual([23]);
    expect(otherPsalmNumbers([row(9, 1, { psalmHebrew: "9:1" }), row(9, 22, { psalmHebrew: "10:1" })], 9)).toEqual([10]);
    expect(otherPsalmNumbers([row(1, 1)], 1)).toEqual([]);
  });

  it("psalmNote", () => {
    expect(psalmNote([23])).toBe("(23)");
    expect(psalmNote([9, 10])).toBe("(9–10)");
  });
});
