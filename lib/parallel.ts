import type { EditionIndex, VerseRow } from "./types";

/** The Psalms in the Catholic canon numbering of the endpoint's index. */
export const PSALMS = 23;

/**
 * One line of the comparison: a verse of the main edition (`a`) and of each compared edition (`others`, in
 * the order of the compared editions; a hole where an edition has no such verse).
 */
export type ParallelRow = { key: string; a?: VerseRow; others: (VerseRow | undefined)[] };

/**
 * What pairs two editions' verses: in the Psalms the Hebrew reference every row carries (VGCL 9:22 is
 * Hebrew 10:1), elsewhere the chapter and verse.
 */
export function alignKey(row: VerseRow, book: number): string {
  if (book === PSALMS && row.psalmHebrew) return row.psalmHebrew;
  return `${row.chapter}:${row.verse}`;
}

/**
 * The editions' verses as rows, in the order of the main edition `a`. Each compared edition is merged in
 * turn: each of its rows joins the first row with its key that has none of that edition yet (so two compared
 * editions share the row of a verse the main edition lacks); a row without one gets a row of its own after
 * the row of the edition's preceding match.
 */
export function buildRows(a: VerseRow[], others: VerseRow[][], book: number): ParallelRow[] {
  const n = others.length;
  const rows: ParallelRow[] = a.map((r) => ({ key: alignKey(r, book), a: r, others: new Array(n).fill(undefined) }));
  others.forEach((list, k) => {
    let after = -1;
    for (const r of list) {
      const key = alignKey(r, book);
      const at = rows.findIndex((x) => x.key === key && !x.others[k]);
      if (at >= 0) {
        rows[at].others[k] = r;
        after = at;
      } else {
        after += 1;
        const cells: (VerseRow | undefined)[] = new Array(n).fill(undefined);
        cells[k] = r;
        rows.splice(after, 0, { key, others: cells });
      }
    }
  });
  return rows;
}

/** The Hebrew psalms the rows report (`psalmHebrew` "10:1" → 10), distinct, in order: VGCL 9 → [9, 10]. */
export function psalmChapters(rows: VerseRow[]): number[] {
  const out: number[] = [];
  for (const r of rows) {
    const n = r.psalmHebrew ? parseInt(r.psalmHebrew, 10) : NaN;
    if (Number.isInteger(n) && !out.includes(n)) out.push(n);
  }
  return out;
}

/** A Hebrew reference as [psalm, verse]: "116:10" → [116, 10]. */
export function hebrewRef(r: VerseRow): [number, number] | null {
  const m = /^(\d+):(\d+)/.exec(r.psalmHebrew ?? "");
  return m ? [Number(m[1]), Number(m[2])] : null;
}

function counts(index: EditionIndex, book: number, tradition?: string): number[] | undefined {
  const b = index.books.find((x) => x.bookNum === book);
  if (!b) return undefined;
  // Esther with both texts: the Greek unless the Hebrew is asked for (the API's default).
  return b.greekVersesPerChapter && tradition !== "HEBREW" ? b.greekVersesPerChapter : b.versesPerChapter;
}

/**
 * How the second edition sits beside the main one. Outside the Psalms, editions that divide a book's
 * chapters differently (Joel 3 in NABRE is not Joel 3 in VGCL) show it whole below: a differing verse count
 * for the chapter (or no such chapter) is the sign. The Psalms always align by the Hebrew reference.
 */
export function pairingMode(aIndex: EditionIndex, bIndex: EditionIndex, book: number, chapter: number, tradition?: string): "aligned" | "whole-chapter" {
  if (book === PSALMS) return "aligned";
  const a = counts(aIndex, book, tradition)?.[chapter - 1];
  const b = counts(bIndex, book, tradition)?.[chapter - 1];
  return a !== undefined && a === b ? "aligned" : "whole-chapter";
}
