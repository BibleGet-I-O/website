import { describe, it, expect } from "vitest";
import { printedElsewhere, psalmNote } from "@/lib/why";
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
});
