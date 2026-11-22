import type { PassageRow } from "./api";

/** The verses of one book and printed chapter, as a reference search shows them under one heading. */
export type PassageGroup = { bookNum: number; chapter: number; rows: PassageRow[] };

/**
 * A passage's rows in the endpoint's order, cut wherever the book or the printed chapter changes: a verse printed
 * in another chapter (NABRE Wis 12:1, printed at the end of 11) goes under the chapter it is printed in.
 */
export function groupPassage(rows: PassageRow[]): PassageGroup[] {
  const groups: PassageGroup[] = [];
  for (const row of rows) {
    const chapter = row.printedChapter ?? row.chapter;
    const last = groups[groups.length - 1];
    if (last && last.bookNum === row.bookNum && last.chapter === chapter) last.rows.push(row);
    else groups.push({ bookNum: row.bookNum, chapter, rows: [row] });
  }
  return groups;
}
