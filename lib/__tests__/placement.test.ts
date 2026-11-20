import { describe, it, expect } from "vitest";
import { placeAsPrinted, printedLabel } from "@/lib/placement";
import type { VerseRow } from "@/lib/types";

const row = (chapter: number, verse: number, extra: Partial<VerseRow> = {}): VerseRow => ({
  chapter, verse, label: null, printedChapter: null, text: `${chapter}:${verse}`, titles: [], ...extra,
});

describe("placeAsPrinted", () => {
  it("showsThePrintedLabelOfAVersePrintedInThePreviousChapter", () => {
    // Synthetic Wisdom 11–12: 12:1 is printed at the end of chapter 11 (as NABRE does).
    const eleven = [row(11, 1, { printedChapter: 11 }), row(11, 26, { printedChapter: 11 })];
    const twelveFirst = [row(12, 1, { printedChapter: 11, label: "12:1" })];
    const placed11 = placeAsPrinted([], eleven, twelveFirst, 11);
    expect(placed11.map((r) => r.text)).toEqual(["11:1", "11:26", "12:1"]);
    expect(placed11[2].label).toBe("12:1");

    const twelve = [row(12, 1, { printedChapter: 11, label: "12:1" }), row(12, 2, { printedChapter: 12 })];
    expect(placeAsPrinted([], twelve, [], 12).map((r) => r.text)).toEqual(["12:2"]);
  });

  it("keepsRowsWithoutAPrintedChapterInTheirOwnChapterAndIgnoresTheNextChaptersOwnVerse", () => {
    const placed = placeAsPrinted([row(2, 9)], [row(3, 1), row(3, 2)], [row(4, 1)], 3);
    expect(placed.map((r) => r.text)).toEqual(["3:1", "3:2"]);
  });

  it("placesTheFirstWordsOfAVerseSplitAcrossChapters", () => {
    // Job 10:1 as the endpoint returns it: the first words labelled "10:1" printed in 9, the rest unlabelled in 10.
    const next = [row(10, 1, { printedChapter: 9, label: "10:1", text: "a" }), row(10, 1, { printedChapter: 10, label: "", text: "b" })];
    expect(placeAsPrinted([], [row(9, 35)], next, 9).map((r) => r.text)).toEqual(["9:35", "a"]);
    const ten = placeAsPrinted([row(9, 35)], next.concat(row(10, 2)), [], 10);
    expect(ten.map((r) => r.text)).toEqual(["b", "10:2"]);
    expect(printedLabel(ten[0], 10)).toBe("");
    expect(printedLabel(next[0], 9)).toBe("10:1");
  });

  it("putsAVersePrintedInTheNextChapterAtItsStart", () => {
    // NABRE John 7:53 is printed at the start of John 8 (chapter 7, verse 53, label "7:53", printed_chapter 8).
    const lastOfSeven = [row(7, 53, { printedChapter: 8, label: "7:53" })];
    const seven = [row(7, 52, { printedChapter: 7 }), ...lastOfSeven];
    expect(placeAsPrinted([row(6, 71)], seven, [row(8, 1, { printedChapter: 8 })], 7).map((r) => r.text)).toEqual(["7:52"]);
    const eight = placeAsPrinted(lastOfSeven, [row(8, 1, { printedChapter: 8 }), row(8, 2, { printedChapter: 8 })], [], 8);
    expect(eight.map((r) => r.text)).toEqual(["7:53", "8:1", "8:2"]);
    expect(printedLabel(eight[0], 8)).toBe("7:53");
  });
});

describe("printedLabel with letters", () => {
  const row = (verse: number, segment: string | null, label: string | null = null) =>
    ({ chapter: 1, verse, segment, label, printedChapter: null, text: "", titles: [] });

  it("printsTheVerseLetterWhenTheEditionPrintsNoOtherLabel", () => {
    expect(printedLabel(row(1, "a"), 1)).toBe("1a");
    expect(printedLabel(row(1, null), 1)).toBe("1");
    // The edition's own label still wins (NABRE prints Esther's additions as A:1).
    expect(printedLabel(row(1, "a", "A:1"), 1)).toBe("A:1");
  });
});

