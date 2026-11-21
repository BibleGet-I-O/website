import "server-only";
import { ApiUnavailable, apiResponse } from "./api";
import type { Access } from "./types";

export type SearchMode = "keyword" | "semantic" | "hybrid";
export const SEARCH_MODES: readonly SearchMode[] = ["keyword", "semantic", "hybrid"];

/** Keyword results come in pages of this many; semantic and hybrid return at most SEMANTIC_LIMIT, unpaged. */
export const PAGE_SIZE = 50;
export const SEMANTIC_LIMIT = 30;

/** One verse a search found, with what the reader needs to link to it and to print its number. */
export type SearchHit = {
  bookNum: number;
  book: string;
  chapter: number;
  verse: number;
  segment: string | null;
  printedChapter: number | null;
  label: string | null;
  text: string;
};

/**
 * `total`: the hits this reader may see (keyword: over every page); `capped`: the matches before the 30-verse cap,
 * when the API capped this edition for this reader.
 */
export type SearchOutcome =
  | { kind: "ok"; hits: SearchHit[]; total: number; capped: number | null }
  | { kind: "refused" }
  | { kind: "semanticUnavailable" };

type RawHit = {
  book?: string; univbooknum?: number | string; chapter: number; verse: number; verse_segment?: string | null;
  printed_chapter?: number | null; verse_label?: string | null; text?: string;
};
type RawSearch = { results?: RawHit[]; info?: { TOTAL?: number; CAPPED?: Record<string, number> } };

const toHit = (r: RawHit): SearchHit => ({
  bookNum: Number(r.univbooknum ?? 0),
  book: r.book ?? "",
  chapter: r.chapter,
  verse: r.verse,
  segment: r.verse_segment ?? null,
  printedChapter: r.printed_chapter ?? null,
  label: r.verse_label ?? null,
  text: r.text ?? "",
});

function searchPath(p: { sigla: string; mode: SearchMode; q: string; exact: boolean; page: number }): string {
  if (p.mode === "keyword") {
    const qs = new URLSearchParams({
      keyword: p.q, version: p.sigla, match: p.exact ? "exact" : "fulltext",
      limit: String(PAGE_SIZE), offset: String((Math.max(1, p.page) - 1) * PAGE_SIZE),
    });
    return `/search/keyword?${qs}`;
  }
  return `/search/${p.mode}?${new URLSearchParams({ query: p.q, version: p.sigla, limit: String(SEMANTIC_LIMIT) })}`;
}

/** Search one edition with the reader's key (the API applies the copyright cap to it). */
export async function searchEdition(p: { sigla: string; mode: SearchMode; q: string; exact: boolean; page: number; access: Access }): Promise<SearchOutcome> {
  const res = await apiResponse(searchPath(p), p.access);
  // A keyword too short or only common words, or a question the API can't take.
  if (res.status === 422) return { kind: "refused" };
  if (res.status === 503 && p.mode !== "keyword") return { kind: "semanticUnavailable" };
  if (!res.ok) {
    if (res.status === 401 || res.status === 403 || res.status === 429) console.error(`BibleGet endpoint answered ${res.status} for search`);
    throw new ApiUnavailable(`endpoint answered ${res.status}`);
  }
  let body: RawSearch;
  try {
    body = (await res.json()) as RawSearch;
  } catch {
    throw new ApiUnavailable("endpoint returned an unreadable body");
  }
  const hits = (body.results ?? []).map(toHit);
  const total = p.mode === "keyword" && typeof body.info?.TOTAL === "number" ? body.info.TOTAL : hits.length;
  const capped = body.info?.CAPPED?.[p.sigla];
  return { kind: "ok", hits, total, capped: typeof capped === "number" ? capped : null };
}

/** Up to 8 words of the edition that start with `prefix`, most frequent first (the read key: words are not verses). */
export async function suggestWords(sigla: string, prefix: string): Promise<string[]> {
  const res = await apiResponse(
    `/search/suggest?${new URLSearchParams({ prefix, version: sigla, limit: "8" })}`,
    "visitor",
    { next: { revalidate: 3600 } },
  );
  if (!res.ok) throw new ApiUnavailable(`endpoint answered ${res.status}`);
  const body = (await res.json()) as { suggestions?: { word?: unknown }[] };
  return (body.suggestions ?? []).map((s) => s.word).filter((w): w is string => typeof w === "string");
}
