import "server-only";
import { hasChapter, PROLOGUE } from "@/lib/chapters";
import { ApiUnavailable, getChapter, getIndex, getVerses, NotFound } from "./api";
import { hasBothEstherTexts } from "./esther";
import { hebrewRef, pairingMode, psalmChapters, PSALMS } from "./parallel";
import type { Access, Book, EditionIndex, VerseRow } from "./types";

export type Second =
  /** Verse beside verse. `truncated`: the second edition stops early (capped), so its empty side has no notes. */
  | { mode: "aligned"; rows: VerseRow[]; truncated: boolean; book: Book }
  /** The editions divide the book's chapters differently: the second's chapter whole, below (none: no such chapter). */
  | { mode: "whole-chapter"; rows: VerseRow[]; truncated: boolean; book: Book }
  /** No such book or chapter; or Esther 11-16 of a Vulgate-numbered main edition, which the second prints as additions. */
  | { mode: "missing"; reason: "book" | "chapter" | "prologue" | "esther-additions" }
  /** The endpoint could not be reached for the second edition. */
  | { mode: "unavailable" };

export type SecondParams = {
  mainSigla: string;
  mainBookAbbrev: string;
  mainIndex: EditionIndex;
  bookNum: number;
  chapter: number;
  /** The main edition's rows as printed on this page. */
  mainRows: VerseRow[];
  withSigla: string;
  access: Access;
  tradition?: string;
};

/** The endpoint's cap on a copyrighted edition for the read key. */
export const VERSE_CAP = 30;

async function orMissing<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (err) {
    if (err instanceof NotFound) return null;
    throw err;
  }
}

const refKey = (r: VerseRow) => {
  const ref = hebrewRef(r);
  return ref ? `${ref[0]}:${ref[1]}` : null;
};

/**
 * One Hebrew psalm of the second edition, trimmed to this page. A Hebrew psalm the main edition splits across
 * two chapters (DRB/VGCL 114-115 = Hebrew 116) is fetched whole, so the main edition is asked for the same
 * Hebrew psalm too: rows whose Hebrew verse it prints in another chapter belong to that chapter's page.
 * Hebrew-numbered requests never report `truncated`, so a cap is inferred: exactly VERSE_CAP rows while
 * the main edition's rows on this page go beyond the last of them in this psalm.
 */
async function psalm(p: SecondParams, request: { sigla: string; bookAbbrev: string; access: Access }, hebrew: number) {
  const [second, main] = await Promise.all([
    orMissing(getChapter({ ...request, chapter: hebrew, numbering: "hebrew" })),
    orMissing(getChapter({ sigla: p.mainSigla, bookAbbrev: p.mainBookAbbrev, access: p.access, chapter: hebrew, numbering: "hebrew" })),
  ]);
  const rows = second?.rows ?? [];
  const here = new Set<string>();
  const elsewhere = new Set<string>();
  for (const r of main?.rows ?? []) {
    const k = refKey(r);
    if (k) ((r.printedChapter ?? r.chapter) === p.chapter ? here : elsewhere).add(k);
  }
  for (const r of p.mainRows) {
    const k = refKey(r);
    if (k) here.add(k);
  }
  const kept = rows.filter((r) => {
    const k = refKey(r);
    return !k || here.has(k) || !elsewhere.has(k);
  });
  const last = rows.length > 0 ? hebrewRef(rows[rows.length - 1]) : null;
  const truncated =
    rows.length === VERSE_CAP &&
    last !== null &&
    p.mainRows.some((r) => {
      const ref = hebrewRef(r);
      return ref !== null && ref[0] === hebrew && ref[1] > last[1];
    });
  return { rows: kept, truncated };
}

async function load(p: SecondParams): Promise<Second> {
  const bIndex = await orMissing(getIndex(p.withSigla));
  const book = bIndex?.books.find((b) => b.bookNum === p.bookNum);
  if (!bIndex || !book) return { mode: "missing", reason: "book" };
  const tradition = hasBothEstherTexts(book) ? p.tradition : undefined;
  const request = { sigla: p.withSigla, bookAbbrev: book.abbrev, access: p.access, ...(tradition && { tradition }) };

  if (p.bookNum === PSALMS) {
    const hebrew = psalmChapters(p.mainRows);
    if (hebrew.length === 0) hebrew.push(p.chapter);
    const parts = await Promise.all(hebrew.map((h) => psalm(p, request, h)));
    const rows = parts.flatMap((x) => x.rows);
    if (rows.length === 0) return { mode: "missing", reason: "chapter" };
    return { mode: "aligned", rows, truncated: parts.some((x) => x.truncated), book };
  }

  if (p.chapter === PROLOGUE && !hasChapter(book, PROLOGUE)) return { mode: "missing", reason: "prologue" };
  if (p.chapter > book.chapters) {
    // VGCL/DRB Esther 11-16 are the Greek additions an edition with both texts prints within chapters 1-10.
    if (hasBothEstherTexts(book)) return { mode: "missing", reason: "esther-additions" };
    return { mode: "whole-chapter", rows: [], truncated: false, book };
  }
  const mode = pairingMode(p.mainIndex, bIndex, p.bookNum, p.chapter, p.tradition);
  const second = await orMissing(getChapter({ ...request, chapter: p.chapter }));
  if (!second) return mode === "whole-chapter" ? { mode, rows: [], truncated: false, book } : { mode: "missing", reason: "chapter" };
  if (mode === "whole-chapter") return { mode, rows: second.rows, truncated: second.truncated, book };
  return { mode, rows: await withForeignVerses(p, request, second.rows), truncated: second.truncated, book };
}

/**
 * The second edition's chapter plus its own copy of each main verse printed on this page from another
 * chapter (NABRE prints John 7:53 at the start of John 8: it is fetched as the second edition's John 7:53),
 * so the two pair. Earlier chapters' verses go first, later ones last; a verse the chapter already has is
 * neither fetched nor repeated.
 */
async function withForeignVerses(
  p: SecondParams,
  request: { sigla: string; bookAbbrev: string; access: Access; tradition?: string },
  rows: VerseRow[],
): Promise<VerseRow[]> {
  const key = (r: VerseRow) => `${r.chapter}:${r.verse}`;
  const have = new Set(rows.map(key));
  const wanted: { chapter: number; verse: number }[] = [];
  for (const r of p.mainRows) {
    if (r.chapter === p.chapter || have.has(key(r))) continue;
    have.add(key(r));
    wanted.push({ chapter: r.chapter, verse: r.verse });
  }
  if (wanted.length === 0) return rows;
  const fetched = await Promise.all(wanted.map((w) => orMissing(getVerses({ ...request, ...w }))));
  const extra = fetched.flatMap((x, i) => (x ?? []).filter((r) => key(r) === `${wanted[i].chapter}:${wanted[i].verse}`));
  return [...extra.filter((r) => r.chapter < p.chapter), ...rows, ...extra.filter((r) => r.chapter > p.chapter)];
}

/**
 * The second edition of the interlinear, with the main edition's access. In the Psalms it is fetched by the
 * Hebrew psalm(s) the main edition's rows report, with Hebrew numbering, so the endpoint maps each to the
 * second edition's own numbering (NABRE Ps 10 beside VGCL 9:22-39; VGCL 9 beside NABRE 9 and 10).
 * Elsewhere it is the same chapter, aligned or whole (see pairingMode). An unreachable endpoint costs only
 * the second edition: the page still shows the main one.
 */
export async function loadSecond(p: SecondParams): Promise<Second> {
  try {
    return await load(p);
  } catch (err) {
    if (!(err instanceof ApiUnavailable)) throw err;
    // ApiUnavailable messages carry the status, never the URL or key.
    console.error(`[interlinear] second edition unavailable (${err.message})`);
    return { mode: "unavailable" };
  }
}
