import type { VerseRow } from "./types";

/** The chapter a row is printed in: its own unless the edition prints it under another one. */
const printedIn = (r: VerseRow) => r.printedChapter ?? r.chapter;

/**
 * The rows printed in `chapter`, in printed order: the previous chapter's last verse when the edition prints
 * it at the start of this one (NABRE John 7:53 opens John 8), this chapter's own rows, then the next
 * chapter's first verse when it is printed at the end of this one (NABRE Wis 12:1 closes Wis 11).
 * Rows of `current` printed in another chapter are dropped: they appear on that chapter's page.
 */
export function placeAsPrinted(prevLast: VerseRow[], current: VerseRow[], nextFirst: VerseRow[], chapter: number): VerseRow[] {
  return [...prevLast, ...current, ...nextFirst].filter((r) => printedIn(r) === chapter);
}

/**
 * The verse number to print: the edition's label, prefixed with the chapter when the verse belongs to another.
 * An empty label (the rest of a verse whose first words are printed in the chapter before) prints nothing.
 */
export function printedLabel(r: VerseRow, chapter: number): string {
  if (r.label === "") return "";
  const label = r.label ?? `${r.verse}${r.segment ?? ""}`;
  return r.chapter !== chapter && !label.includes(":") ? `${r.chapter}:${label}` : label;
}

/**
 * The id a verse carries on a chapter page (`v3.16`, `v1.1a`), so a search result can link to it
 * (`…/john/3#v3.16`). The chapter is part of it: a page also prints a neighbour chapter's verse.
 */
export function verseAnchor(r: { chapter: number; verse: number; segment?: string | null }): string {
  return `v${r.chapter}.${r.verse}${r.segment ?? ""}`;
}
