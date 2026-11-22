/**
 * The reader's kinds of search, for the form (client) and the results page (server) alike. Semantic is served by
 * the endpoint's hybrid route, which is never worse than its pure semantic one (measured 2026-11-22).
 */
export type SearchMode = "keyword" | "semantic" | "reference";
export const SEARCH_MODES: readonly SearchMode[] = ["keyword", "semantic", "reference"];

/** A URL's `mode`: an old `hybrid` link is the same search as semantic; anything unknown is keyword. */
export function parseMode(raw: string | undefined): SearchMode {
  if (raw === "hybrid") return "semantic";
  return SEARCH_MODES.includes(raw as SearchMode) ? (raw as SearchMode) : "keyword";
}
