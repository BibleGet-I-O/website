"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getAccessToken } from "@/lib/access";
import { reviewUrl, type ReviewKind, type ReviewLinkData } from "@/lib/review";

/** One reviewer action on a link: what PATCH /review/links/{id} takes. */
export type ReviewChange =
  | { action: "accept" | "none" }
  | { action: "relink"; units: string[] }
  | { action: "split"; note: string }
  | { kind: ReviewKind };

export type ReviewResult = { ok: true; link: ReviewLinkData } | { ok: false; status: number };
export type AcceptResult = { ok: true; accepted: number } | { ok: false; status: number };

const UNIT = /^btu:[a-z0-9]+\.[1-9]\d*\.\d+[a-z]*(\.\d+)*(\+\d+(\.\d+)*)?$/;

function valid(change: ReviewChange): boolean {
  if ("kind" in change) return change.kind === "same" || change.kind === "corresponding";
  if (change.action === "accept" || change.action === "none") return Object.keys(change).length === 1;
  if (change.action === "relink") return Array.isArray(change.units) && change.units.length > 0 && change.units.every((u) => typeof u === "string" && UNIT.test(u));
  if (change.action === "split") return typeof change.note === "string" && change.note.trim().length > 0 && change.note.length <= 1000;
  return false;
}

/** The reviewer's token, or the status to answer: 403 without the role, 401 without a usable token. */
async function reviewerToken(): Promise<string | number> {
  const session = await auth();
  if (!session?.user || session.error || session.reviewer !== true) return 403;
  return (await getAccessToken()) ?? 401;
}

/**
 * Applies one reviewer action to a link. Runs in a Server Action so an expired access token can be
 * refreshed; the token never leaves this function.
 */
export async function reviewLink(id: number, change: ReviewChange): Promise<ReviewResult> {
  if (!Number.isInteger(id) || id < 1 || typeof change !== "object" || change === null || !valid(change)) return { ok: false, status: 400 };
  const token = await reviewerToken();
  if (typeof token === "number") return { ok: false, status: token };
  const url = reviewUrl(`/links/${id}`);
  if (!url) return { ok: false, status: 0 };
  try {
    const res = await fetch(url, {
      method: "PATCH",
      cache: "no-store",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(change),
    });
    if (!res.ok) return { ok: false, status: res.status };
    revalidatePath("/[locale]/review", "page");
    return { ok: true, link: (await res.json()) as ReviewLinkData };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** Accepts the chapter's remaining drafts (offered only on the chapter's page, after it has been shown). */
export async function acceptChapter(edition: string, book: number, chapter: number): Promise<AcceptResult> {
  if (!/^[A-Z0-9]{2,10}$/.test(edition) || !Number.isInteger(book) || book < 1 || book > 73 || !Number.isInteger(chapter) || chapter < 1) {
    return { ok: false, status: 400 };
  }
  const token = await reviewerToken();
  if (typeof token === "number") return { ok: false, status: token };
  const url = reviewUrl(`/editions/${edition}/books/${book}/chapters/${chapter}/accept`);
  if (!url) return { ok: false, status: 0 };
  try {
    const res = await fetch(url, { method: "POST", cache: "no-store", headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
    if (!res.ok) return { ok: false, status: res.status };
    revalidatePath("/[locale]/review", "page");
    revalidatePath("/[locale]/review/[edition]/[book]/[chapter]", "page");
    return { ok: true, accepted: ((await res.json()) as { accepted: number }).accepted };
  } catch {
    return { ok: false, status: 0 };
  }
}
