export type Access = "visitor" | "reader";

export type Edition = {
  sigla: string;
  fullname: string;
  year: string;
  language: string;
  copyrightHolder: string;
};

export type Book = {
  bookNum: number;
  name: string;
  abbrev: string;
  chapters: number;
  versesPerChapter: number[];
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
