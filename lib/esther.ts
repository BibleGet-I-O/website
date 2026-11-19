import type { Book } from "./types";

/** Esther in the Catholic canon numbering. */
export const ESTHER = 19;

export type Tradition = "GREEK" | "HEBREW";

/** Whether this is Esther in an edition that stores both texts, as its index shows (see getIndex). */
export const hasBothEstherTexts = (book: Pick<Book, "bookNum" | "greekVersesPerChapter">) =>
  book.bookNum === ESTHER && book.greekVersesPerChapter !== undefined;

/** The tradition to request: only for Esther in an edition with both texts, Greek (the API's default) otherwise. */
export function estherTradition(book: Pick<Book, "bookNum" | "greekVersesPerChapter">, param: unknown): Tradition | undefined {
  if (!hasBothEstherTexts(book)) return undefined;
  return param === "HEBREW" ? "HEBREW" : "GREEK";
}
