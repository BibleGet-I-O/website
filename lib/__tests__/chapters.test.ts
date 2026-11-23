import { describe, it, expect } from "vitest";
import { chapterNumbers, firstChapter, hasChapter, versesIn } from "../chapters";

const sirach = { chapters: 3, versesPerChapter: [30, 18, 31], prologue: 1 };
const wisdom = { chapters: 2, versesPerChapter: [16, 24] };
const esther = { chapters: 2, versesPerChapter: [22, 23], greekVersesPerChapter: [40, 30] };

describe("chapters", () => {
  it("aPrologueComesBeforeChapterOne", () => {
    expect(chapterNumbers(sirach)).toEqual([0, 1, 2, 3]);
    expect(chapterNumbers(wisdom)).toEqual([1, 2]);
    expect(chapterNumbers({ ...sirach, prologue: 0 })).toEqual([1, 2, 3]);
    expect(firstChapter(sirach)).toBe(0);
    expect(firstChapter(wisdom)).toBe(1);
  });

  it("chapterZeroExistsOnlyWithAPrologue", () => {
    expect(hasChapter(sirach, 0)).toBe(true);
    expect(hasChapter(wisdom, 0)).toBe(false);
    expect(hasChapter(sirach, 3)).toBe(true);
    expect(hasChapter(sirach, 4)).toBe(false);
    expect(hasChapter(sirach, -1)).toBe(false);
  });

  it("thePrologueCountsItsOwnVerses", () => {
    expect(versesIn(sirach, 0)).toBe(1);
    expect(versesIn(sirach, 2)).toBe(18);
    expect(versesIn(wisdom, 0)).toBeUndefined();
    expect(versesIn(wisdom, 3)).toBeUndefined();
    // Esther with both texts: the Greek unless the Hebrew is asked for.
    expect(versesIn(esther, 1)).toBe(40);
    expect(versesIn(esther, 1, "HEBREW")).toBe(22);
  });
});
