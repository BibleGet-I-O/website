import "server-only";
import { getAccessToken } from "@/lib/access";

/** An edition's links to CBTUDR units, by status. */
export type ReviewEdition = { edition: string; draft: number; reviewed: number; rule: number };
/** A chapter that still has drafts; `min_confidence` is its least confident draft's. */
export type ReviewChapterSummary = { book: number; chapter: number; drafts: number; min_confidence: number };
export type ReviewKind = "same" | "corresponding";
export type ReviewStatus = "rule" | "draft" | "reviewed";
/** A link from one verse of the edition (`ref`) to units of the Nova Vulgata. */
export type ReviewLinkData = {
  id: number;
  ref: string;
  units: string[];
  kind: ReviewKind;
  status: ReviewStatus;
  confidence: number | null;
  stretch: string | null;
  note: string | null;
};
/** A unit a draft of its stretch may be relinked to; `ref` is the Nova Vulgata reference it began as. */
export type ReviewUnit = { id: string; ref: string; stretch: string };
export type ReviewChapter = { links: ReviewLinkData[]; units: ReviewUnit[] };

export type Fetched<T> = { data: T } | { error: "signIn" | "failed" | "notFound" };

/** Absolute URL of a review route on the endpoint, or null when BIBLEGET_API_URL is unset. */
export function reviewUrl(path: string): string | null {
  const base = process.env.BIBLEGET_API_URL;
  return base ? `${base.replace(/\/+$/, "")}/review${path}` : null;
}

/** GET a review route with the signed-in reviewer's token. */
export async function reviewGet<T>(path: string): Promise<Fetched<T>> {
  // In a Server Component an expired token is not refreshed (cookies cannot be written): ask to sign in again.
  const token = await getAccessToken();
  const url = reviewUrl(path);
  if (!token) return { error: "signIn" };
  if (!url) return { error: "failed" };
  try {
    const res = await fetch(url, { cache: "no-store", headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
    if (res.status === 401) return { error: "signIn" };
    if (res.status === 404) return { error: "notFound" };
    if (!res.ok) return { error: "failed" };
    return { data: (await res.json()) as T };
  } catch {
    return { error: "failed" };
  }
}

/** "btu:tb.5.4.2" -> [5, 4]: the Nova Vulgata chapter and verse a unit began as. */
export function unitChapterVerse(id: string): [number, number] | null {
  const m = /^btu:[a-z0-9]+\.(\d+)\.(\d+)/.exec(id);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** A verse's text without the edition's formatting tags. */
export function plainText(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}
