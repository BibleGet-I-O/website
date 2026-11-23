/** The two testaments, by book number: 1-46 the Old, 47-73 the New (the endpoint's Catholic numbering). */
export type Testament = "ot" | "nt";

export type SectionKey =
  | "pentateuch"
  | "historical"
  | "wisdom"
  | "prophets"
  | "gospels"
  | "acts"
  | "paul"
  | "catholic"
  | "revelation";

/** The books' sections in canon order, as the endpoint numbers them (wiki: Book Numbering). Hebrews (65) opens the Catholic Letters. */
const SECTIONS: readonly { key: SectionKey; testament: Testament; first: number; last: number }[] = [
  { key: "pentateuch", testament: "ot", first: 1, last: 5 },
  { key: "historical", testament: "ot", first: 6, last: 21 },
  { key: "wisdom", testament: "ot", first: 22, last: 28 },
  { key: "prophets", testament: "ot", first: 29, last: 46 },
  { key: "gospels", testament: "nt", first: 47, last: 50 },
  { key: "acts", testament: "nt", first: 51, last: 51 },
  { key: "paul", testament: "nt", first: 52, last: 64 },
  { key: "catholic", testament: "nt", first: 65, last: 72 },
  { key: "revelation", testament: "nt", first: 73, last: 73 },
];

/** The section and testament of a book number (1-73). */
export function sectionOf(bookNum: number): { key: SectionKey; testament: Testament } {
  const s = SECTIONS.find((x) => bookNum >= x.first && bookNum <= x.last);
  if (!s) throw new RangeError(`No book ${bookNum}`);
  return { key: s.key, testament: s.testament };
}

/** The books grouped by section, in canon order; a section with none of the books is left out. */
export function groupBySection<B extends { bookNum: number }>(
  books: readonly B[],
): { key: SectionKey; testament: Testament; books: B[] }[] {
  return SECTIONS.map((s) => ({
    key: s.key,
    testament: s.testament,
    books: books.filter((b) => b.bookNum >= s.first && b.bookNum <= s.last),
  })).filter((s) => s.books.length > 0);
}
