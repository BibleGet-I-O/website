import type { Edition } from "./types";

/** An edition's place on its language's shelf: liturgical texts, then other Catholic editions, then the rest. */
function group(e: Edition): number {
  if (e.liturgical) return 0;
  return e.canon === "CATHOLIC" ? 1 : 2;
}

/**
 * Orders one language's editions: by group (liturgical, other Catholic, the rest), then newest year first
 * (an edition without a year last), then by name.
 */
export function shelfOrder(editions: readonly Edition[], locale: string): Edition[] {
  return [...editions].sort(
    (a, b) =>
      group(a) - group(b) ||
      Number(!a.year) - Number(!b.year) ||
      b.year.localeCompare(a.year, undefined, { numeric: true }) ||
      a.fullname.localeCompare(b.fullname, locale),
  );
}
