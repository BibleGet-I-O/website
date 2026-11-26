import "server-only";
import { slugFor } from "@/lib/api";
import type { EditionIndex, Introduction, NoteRef, PrintedPiece, VerseRow } from "@/lib/types";

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
            const href = to && passageHref(ref.start, to);
            if (!href) return ref;
            return { ...ref, href, ...(other && to.name && { editionName: to.name }) };
          }),
        },
      })),
    };
  });
}

/** The link to a passage in an edition: the chapter that prints it, at its verse; undefined for a book it lacks. */
export function passageHref(start: NoteRef["start"], to: EditionLinks): string | undefined {
  const book = to.index.books.find((b) => b.bookNum === start.book);
  if (!book) return undefined;
  const { chapter, verse, segment, printedChapter } = start;
  const anchor = verse === null ? "" : `#v${chapter}.${verse}${segment ?? ""}`;
  return `${to.base}/${slugFor(book, to.index.books)}/${printedChapter ?? chapter}${to.query}${anchor}`;
}

/** An introduction with each citation's link, and each misprint's intended passage's, into its own edition. */
export function withIntroLinks(intro: Introduction, to: EditionLinks): Introduction {
  const link = (p: PrintedPiece): PrintedPiece => ({
    ...p,
    refs: p.refs.map((r) => ({ ...r, ...(passageHref(r.start, to) && { href: passageHref(r.start, to) }) })),
    ...(p.sic && { sic: p.sic.map((s) => (s.ref ? { ...s, ref: { ...s.ref, ...(passageHref(s.ref.start, to) && { href: passageHref(s.ref.start, to) }) } } : s)) }),
  });
  return { ...intro, blocks: intro.blocks.map((b) => (b.type === "row" ? { ...b, cells: b.cells.map(link) } : { ...b, ...link(b) })) };
}
