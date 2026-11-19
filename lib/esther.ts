/** Esther in the Catholic canon numbering. */
export const ESTHER = 19;

/** Editions that store both the Greek and the Hebrew Esther, selected with `text_tradition`. */
const BOTH_TEXTS = new Set(["CEI2008", "NABRE", "NVBSE", "BLPD"]);

export type Tradition = "GREEK" | "HEBREW";

export const hasBothEstherTexts = (sigla: string, bookNum: number) => bookNum === ESTHER && BOTH_TEXTS.has(sigla.toUpperCase());

/** The tradition to request: only for Esther in an edition with both texts, Greek (the API's default) otherwise. */
export function estherTradition(sigla: string, bookNum: number, param: unknown): Tradition | undefined {
  if (!hasBothEstherTexts(sigla, bookNum)) return undefined;
  return param === "HEBREW" ? "HEBREW" : "GREEK";
}
