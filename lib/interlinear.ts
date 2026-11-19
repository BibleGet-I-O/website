import "server-only";
import { getChapter, getIndex, NotFound } from "./api";
import { hasBothEstherTexts } from "./esther";
import { hebrewRef, pairingMode, psalmChapters, PSALMS } from "./parallel";
import type { Access, Book, EditionIndex, VerseRow } from "./types";

export type Second = {
  /** "missing": the second edition has no such book or chapter. */
  mode: "aligned" | "whole-chapter" | "missing";
  rows: VerseRow[];
  /** The second edition's book, for its heading. */
  book?: Book;
};

export type SecondParams = {
  mainIndex: EditionIndex;
  bookNum: number;
  chapter: number;
  /** The main edition's rows as printed on this page. */
  mainRows: VerseRow[];
  withSigla: string;
  access: Access;
  tradition?: string;
  /** The main edition's neighbouring verses (its previous chapter's last, its next chapter's first). */
  prevLast?: VerseRow[];
  nextFirst?: VerseRow[];
};

const MISSING: Second = { mode: "missing", rows: [] };

async function orMissing<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (err) {
    if (err instanceof NotFound) return null;
    throw err;
  }
}

/**
 * A Hebrew psalm the main edition splits across two chapters (VGCL 114-115 = Hebrew 116) is fetched whole:
 * keep only the verses the main edition does not print in its neighbouring chapters.
 */
function notInNeighbours(rows: VerseRow[], prevLast: VerseRow[], nextFirst: VerseRow[]): VerseRow[] {
  const prev = prevLast.map(hebrewRef).filter((x) => x !== null);
  const next = nextFirst.map(hebrewRef).filter((x) => x !== null);
  return rows.filter((r) => {
    const ref = hebrewRef(r);
    if (!ref) return true;
    const [ps, v] = ref;
    return !prev.some(([p, pv]) => p === ps && v <= pv) && !next.some(([p, nv]) => p === ps && v >= nv);
  });
}

/**
 * The second edition of the interlinear, with the main edition's access. In the Psalms it is fetched by the
 * Hebrew psalm(s) the main edition's rows report, with Hebrew numbering, so the endpoint maps each to the
 * second edition's own numbering (NABRE Ps 10 beside VGCL 9:22-39; VGCL 9 beside NABRE 9 and 10).
 * Elsewhere it is the same chapter, aligned or whole (see pairingMode). Shown as returned: never capped here.
 */
export async function loadSecond(p: SecondParams): Promise<Second> {
  const bIndex = await orMissing(getIndex(p.withSigla));
  const book = bIndex?.books.find((b) => b.bookNum === p.bookNum);
  if (!bIndex || !book) return MISSING;
  const tradition = hasBothEstherTexts(book) ? p.tradition : undefined;
  const request = { sigla: p.withSigla, bookAbbrev: book.abbrev, access: p.access, ...(tradition && { tradition }) };

  if (p.bookNum === PSALMS) {
    const psalms = psalmChapters(p.mainRows);
    if (psalms.length === 0) psalms.push(p.chapter);
    const parts = await Promise.all(psalms.map((chapter) => orMissing(getChapter({ ...request, chapter, numbering: "hebrew" }))));
    const rows = notInNeighbours(parts.flatMap((c) => c?.rows ?? []), p.prevLast ?? [], p.nextFirst ?? []);
    return rows.length > 0 ? { mode: "aligned", rows, book } : MISSING;
  }

  if (p.chapter > book.chapters) return MISSING;
  const mode = pairingMode(p.mainIndex, bIndex, p.bookNum, p.chapter, p.tradition);
  const second = await orMissing(getChapter({ ...request, chapter: p.chapter }));
  return second ? { mode, rows: second.rows, book } : MISSING;
}
