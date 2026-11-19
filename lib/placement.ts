import type { VerseRow } from "./types";

/** The chapter a row is printed in: its own unless the edition prints it under another one. */
const printedIn = (r: VerseRow) => r.printedChapter ?? r.chapter;

/**
 * The rows printed in `chapter`, in printed order: this chapter's own rows, then the rows of the next
 * chapter's first verse that the edition prints at the end of this one (NABRE Wis 12:1 closes Wis 11).
 * Rows of `current` printed in another chapter are dropped: they appear on that chapter's page.
 */
export function placeAsPrinted(current: VerseRow[], nextFirst: VerseRow[], chapter: number): VerseRow[] {
  return [...current, ...nextFirst].filter((r) => printedIn(r) === chapter);
}

/** The verse number to print: the edition's label, prefixed with the chapter when the verse belongs to another. */
export function printedLabel(r: VerseRow, chapter: number): string {
  const label = r.label ?? String(r.verse);
  return r.chapter !== chapter && !label.includes(":") ? `${r.chapter}:${label}` : label;
}
