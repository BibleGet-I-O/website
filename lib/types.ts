export type Access = "visitor" | "reader";

export type Edition = {
  sigla: string;
  fullname: string;
  year: string;
  language: string;
  copyrightHolder: string;
  /** The edition's notes from the endpoint; may hold several paragraphs separated by newlines. */
  notes: string;
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
  psalmHebrew?: string;
};

export type Chapter = { rows: VerseRow[]; truncated: boolean; expectedVerses: number };
