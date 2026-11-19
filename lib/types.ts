export type Access = "visitor" | "reader";

export type Edition = {
  sigla: string;
  fullname: string;
  year: string;
  language: string;
  copyrightHolder: string;
  /** Listed by the API as copyrighted (`copyrightversions`): visitors get a capped chapter. */
  copyright: boolean;
};

export type Book = {
  bookNum: number;
  name: string;
  abbrev: string;
  chapters: number;
  versesPerChapter: number[];
  /**
   * Esther in an edition that stores both texts: the endpoint's index lists 20 chapters (10 Hebrew, then 10
   * Greek); `chapters` is 10, `versesPerChapter` the Hebrew counts and this the Greek ones.
   */
  greekVersesPerChapter?: number[];
};

export type EditionIndex = { sigla: string; books: Book[] };

export type VerseRow = {
  chapter: number;
  verse: number;
  label: string | null;
  printedChapter: number | null;
  text: string;
  titles: string[];
  /**
   * Where `titles` go: null (or absent) before the verse; otherwise a 0-based code-point offset into `text`
   * for headings inside the verse (the API's `title_position`).
   */
  titlePosition?: number | null;
  psalmHebrew?: string;
};

export type Chapter = { rows: VerseRow[]; truncated: boolean; expectedVerses: number };
