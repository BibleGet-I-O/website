"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getAccessToken } from "@/lib/access";
import { adminUrl } from "@/lib/admin";

export type SetFullTextResult = { ok: true } | { ok: false; status: number };

/**
 * Switches an edition's full text for signed-in readers. Runs in a Server Action so an
 * expired access token can be refreshed; the token never leaves this function.
 */
export async function setFullText(sigla: string, on: boolean): Promise<SetFullTextResult> {
  const session = await auth();
  if (!session?.user || session.error || session.admin !== true) return { ok: false, status: 403 };
  const token = await getAccessToken();
  if (!token) return { ok: false, status: 401 };
  const url = adminUrl(`/admin/versions/${encodeURIComponent(sigla)}`);
  if (!url) return { ok: false, status: 0 };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "PATCH",
      cache: "no-store",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reader_full_text: on }),
    });
  } catch {
    return { ok: false, status: 0 };
  }
  if (!res.ok) return { ok: false, status: res.status };

  // Visitor chapter fetches are cached for an hour; signed-in ones are not cached.
  revalidatePath("/[locale]/admin/editions", "page");
  revalidatePath("/[locale]/read/[edition]/[book]/[chapter]", "page");
  return { ok: true };
}
