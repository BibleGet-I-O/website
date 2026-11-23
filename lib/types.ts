export type Access = "visitor" | "reader";

export type Edition = {
  sigla: string;
  fullname: string;
  year: string;
  language: string;
  /** The canon the edition follows, upper-cased ("CATHOLIC", "PROTESTANT"); empty when unknown. */
  canon: string;
  copyrightHolder: string;
  /** The edition's notes from the endpoint; may hold several paragraphs separated by newlines. */
  notes: string;
  /** Listed by the API as copyrighted (`copyrightversions`): visitors get a capped chapter. */
  copyright: boolean;
  /** Listed by the API as liturgical (`liturgicalversions`): the text read in the liturgy. */
  liturgical: boolean;
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
  /** The prologue's verses (Sirach's foreword, read as chapter 0); absent or 0 when the edition prints none. */
  prologue?: number;
};

export type EditionIndex = { sigla: string; books: Book[] };

/** A passage a note cites: `book` is the universal number; `verse` null for a whole chapter. */
export type NoteRef = {
  start: { book: number; chapter: number; verse: number | null; segment: string | null; printedChapter: number | null };
  end: { book: number; chapter: number; verse: number } | null;
  /** The code points of `body` that print the citation: [start, end). */
  span: [number, number];
  /** Another edition the passage is in, at that edition's numbers (CEI 2008's notes cite the Nova Vulgata); absent: the note's own. */
  edition?: string;
  /** The link to the passage, set by the page (`withNoteLinks`). */
  href?: string;
  /** That other edition's name, set with the link, for the book icon's label. */
  editionName?: string;
};

/** A footnote or cross-reference as the edition prints it (signed-in readers only). */
export type Note = {
  /** `{EDITION}:{source id}`, stable across imports. */
  id: string;
  edition: string;
  kind: "footnote" | "crossref";
  /** The printed marker (`*`, `a`); null where the edition prints none (CEI 2008: the verse number is marked). */
  marker: string | null;
  label: string | null;
  title: string | null;
  /** Inline tags `<i>`, `<b>`, `<sm>` only. */
  body: string;
  refs: NoteRef[];
};

/**
 * Where a note's marker is printed on a row: in its text, or in one of its `titles`, at a code-point offset
 * (tags included, as `titlePosition`); position null marks the verse as a whole (its number).
 */
export type NoteMarker = { note: Note; field: "text" | "title"; titleIndex?: number; position: number | null };

export type VerseRow = {
  chapter: number;
  verse: number;
  /** The verse's letter where the edition divides it (NVBSE Esther 1:1a, CEI2008 Is 10:18b); null otherwise. */
  segment?: string | null;
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
  /** The row's note markers, in printed order (signed-in readers only; absent when none). */
  notes?: NoteMarker[];
};

export type Chapter = { rows: VerseRow[]; truncated: boolean; expectedVerses: number };
