import "server-only";
import { slugFor } from "@/lib/api";
import type { EditionIndex, VerseRow } from "@/lib/types";

/** How to link into an edition: its index, its locale-prefixed path, the query to keep, and (another edition) its name. */
export type EditionLinks = { index: EditionIndex; base: string; query: string; name?: string };

/** The editions the rows' notes cite other than `own` (CEI 2008's notes cite the Nova Vulgata). */
export function editionsCited(rows: VerseRow[], own: string): string[] {
  const out = new Set<string>();
  for (const r of rows) for (const m of r.notes ?? []) for (const ref of m.note.refs) if (ref.edition && ref.edition !== own) out.add(ref.edition);
  return [...out];
}

/**
 * The rows with each note citation's link: the passage in the chapter that prints it (a verse printed in another
 * chapter, as NABRE Wis 12:1 in 11, is found there), in the note's own edition `own` or the one the citation
 * names, with that edition's query (the reader's comparison) and, for another edition, its name. A citation whose
 * edition or book cannot be linked gets no link.
 */
export function withNoteLinks(rows: VerseRow[], own: string, linkFor: (sigla: string) => EditionLinks | undefined): VerseRow[] {
  return rows.map((r) => {
    if (!r.notes) return r;
    return {
      ...r,
      notes: r.notes.map((m) => ({
        ...m,
        note: {
          ...m.note,
          refs: m.note.refs.map((ref) => {
            const other = ref.edition && ref.edition !== own ? ref.edition : undefined;
            const to = linkFor(other ?? own);
            const book = to?.index.books.find((b) => b.bookNum === ref.start.book);
            if (!to || !book) return ref;
            const { chapter, verse, segment, printedChapter } = ref.start;
            const anchor = verse === null ? "" : `#v${chapter}.${verse}${segment ?? ""}`;
            const href = `${to.base}/${slugFor(book, to.index.books)}/${printedChapter ?? chapter}${to.query}${anchor}`;
            return { ...ref, href, ...(other && to.name && { editionName: to.name }) };
          }),
        },
      })),
    };
  });
}
