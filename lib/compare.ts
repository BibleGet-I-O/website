/** At most this many editions beside the main one. */
export const MAX_COMPARED = 2;

/** Side by side (columns, the default) or interlinear (each compared verse under the main one). */
export type View = "side-by-side" | "interlinear";

/**
 * The compared editions of `?with=` (comma-separated siglas, any case): known ones only, never the main
 * edition, each once, at most MAX_COMPARED.
 */
export function parseWith(raw: string | undefined, main: string, known: string[]): string[] {
  const out: string[] = [];
  for (const part of (raw ?? "").split(",")) {
    const s = part.trim().toUpperCase();
    if (s && s !== main && known.includes(s) && !out.includes(s) && out.length < MAX_COMPARED) out.push(s);
  }
  return out;
}

export function parseView(raw: string | undefined): View {
  return raw === "interlinear" ? "interlinear" : "side-by-side";
}

/**
 * The reader's query string ("" or "?…"): the compared editions with literal commas; the view while comparing
 * or reading Esther's two texts (`twoTexts`), side by side being the default; and, while comparing, Esther's
 * text when Hebrew (Greek is the default; read alone, both texts are shown).
 */
export function compareQuery(o: { with: string[]; view: View; tradition?: string; twoTexts?: boolean }): string {
  const parts: string[] = [];
  if (o.with.length > 0) parts.push(`with=${o.with.map(encodeURIComponent).join(",")}`);
  if ((o.with.length > 0 || o.twoTexts) && o.view === "interlinear") parts.push("view=interlinear");
  if (o.with.length > 0 && o.tradition === "HEBREW") parts.push("tradition=HEBREW");
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}
