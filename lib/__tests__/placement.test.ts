import { describe, it, expect } from "vitest";
import { placeAsPrinted } from "@/lib/placement";
import type { VerseRow } from "@/lib/types";

const row = (chapter: number, verse: number, extra: Partial<VerseRow> = {}): VerseRow => ({
  chapter, verse, label: null, printedChapter: null, text: `${chapter}:${verse}`, titles: [], ...extra,
});

describe("placeAsPrinted", () => {
  it("showsThePrintedLabelOfAVersePrintedInThePreviousChapter", () => {
    // Synthetic Wisdom 11–12: 12:1 is printed at the end of chapter 11 (as NABRE does).
    const eleven = [row(11, 1, { printedChapter: 11 }), row(11, 26, { printedChapter: 11 })];
    const twelveFirst = [row(12, 1, { printedChapter: 11, label: "12:1" })];
    const placed11 = placeAsPrinted(eleven, twelveFirst, 11);
    expect(placed11.map((r) => r.text)).toEqual(["11:1", "11:26", "12:1"]);
    expect(placed11[2].label).toBe("12:1");

    const twelve = [row(12, 1, { printedChapter: 11, label: "12:1" }), row(12, 2, { printedChapter: 12 })];
    expect(placeAsPrinted(twelve, [], 12).map((r) => r.text)).toEqual(["12:2"]);
  });

  it("keepsRowsWithoutAPrintedChapterInTheirOwnChapterAndIgnoresTheNextChaptersOwnVerse", () => {
    const placed = placeAsPrinted([row(3, 1), row(3, 2)], [row(4, 1)], 3);
    expect(placed.map((r) => r.text)).toEqual(["3:1", "3:2"]);
  });

  it("placesTheFirstWordsOfAVerseSplitAcrossChapters", () => {
    // Job 10:1a printed at the end of 9, 10:1b at the start of 10.
    const next = [row(10, 1, { printedChapter: 9, label: "1a", text: "a" }), row(10, 1, { printedChapter: 10, label: "1b", text: "b" })];
    expect(placeAsPrinted([row(9, 35)], next, 9).map((r) => r.text)).toEqual(["9:35", "a"]);
  });
});
