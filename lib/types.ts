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

/** A verified misprint, left as printed: "[sic! expected: intended]" follows `span`, the intended passage linked. */
export type Sic = { span: [number, number]; intended: string; ref: { start: NoteRef["start"]; end: NoteRef["end"]; href?: string } | null };

/** Printed text with its citations and misprints (`span`s are code points of `text`, tags included). */
export type PrintedPiece = { text: string; refs: NoteRef[]; sic?: Sic[] };

/** A block of an introduction as printed: outline items carry their own numerals ("I.", "A."). */
export type IntroBlock =
  | ({ type: "heading"; level: number } & PrintedPiece)
  | ({ type: "paragraph" } & PrintedPiece)
  | ({ type: "item"; level: number } & PrintedPiece)
  | { type: "row"; cells: PrintedPiece[] };

/** An introduction's name; `books` are the universal numbers of those it introduces. */
export type IntroHeading = { id: string; title: string; books: number[] };

/** A book's or a general introduction, as the edition prints it (signed-in readers only). */
export type Introduction = IntroHeading & { blocks: IntroBlock[] };

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
  /** Esther's Hebrew text, shown beside the Greek: its markers need ids of their own. */
  tradition?: "HEBREW";
  /** The row's note markers, in printed order (signed-in readers only; absent when none). */
  notes?: NoteMarker[];
  /** A number the edition prints without text (the Nova Vulgata's bracketed verses): the API's `omitted`. */
  omitted?: true;
  /** Persons and places named in `text`, by code-point offsets, ordered by start (NVBSE only). */
  mentions?: Mention[];
};

/** A span of a row's `text` naming an entity (`entry`, settled) or one of several (`candidates`, under review). */
export type Mention = { start: number; end: number; entry?: string; candidates?: string[] };

export type MentionEntity = {
  id: string;
  type: "person" | "place";
  kind: string;
  names: Partial<Record<"la" | "it" | "en", string>>;
  description: Partial<Record<"it" | "en", string>>;
  uncertain: boolean;
  verseCount: number;
  /** A Commons image; a public-domain one may have no author and no licence link. */
  image?: { file: string; author?: string; license: string; licenseUrl?: string };
  wikipedia?: Record<string, string>;
  coords?: { lat: number; lon: number };
};

export type Chapter = { rows: VerseRow[]; truncated: boolean; expectedVerses: number; entities?: Record<string, MentionEntity> };
