import "server-only";
import { slugFor } from "@/lib/api";
import type { EditionIndex, VerseRow } from "@/lib/types";

/**
 * The rows with each note citation's link: the passage in the same edition, in the chapter that prints it (a
 * verse printed in another chapter, as NABRE Wis 12:1 in 11, is found there), `query` (the reader's comparison)
 * kept. A book the edition lacks gets no link.
 */
export function withNoteLinks(rows: VerseRow[], index: EditionIndex, base: string, query = ""): VerseRow[] {
  return rows.map((r) => {
    if (!r.notes) return r;
    return {
      ...r,
      notes: r.notes.map((m) => ({
        ...m,
        note: {
          ...m.note,
          refs: m.note.refs.map((ref) => {
            const book = index.books.find((b) => b.bookNum === ref.start.book);
            if (!book) return ref;
            const { chapter, verse, segment, printedChapter } = ref.start;
            const anchor = verse === null ? "" : `#v${chapter}.${verse}${segment ?? ""}`;
            return { ...ref, href: `${base}/${slugFor(book, index.books)}/${printedChapter ?? chapter}${query}${anchor}` };
          }),
        },
      })),
    };
  });
}
