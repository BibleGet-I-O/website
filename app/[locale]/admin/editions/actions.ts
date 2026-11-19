"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getAccessToken } from "@/lib/access";
import { adminUrl } from "@/lib/admin";

export type EditionFlag = "reader_full_text" | "liturgical";

export type SetEditionFlagResult = { ok: true } | { ok: false; status: number };

const FLAGS: ReadonlySet<string> = new Set<EditionFlag>(["reader_full_text", "liturgical"]);

/**
 * Switches one of an edition's flags: its full text for signed-in readers (`reader_full_text`) or its
 * liturgical status (`liturgical`). Runs in a Server Action so an expired access token can be refreshed; the
 * token never leaves this function.
 */
export async function setEditionFlag(sigla: string, field: EditionFlag, on: boolean): Promise<SetEditionFlagResult> {
  if (!/^[A-Z0-9]{2,16}$/.test(sigla) || typeof field !== "string" || !FLAGS.has(field) || typeof on !== "boolean") {
    return { ok: false, status: 400 };
  }
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
      body: JSON.stringify({ [field]: on }),
    });
  } catch {
    return { ok: false, status: 0 };
  }
  if (!res.ok) return { ok: false, status: res.status };

  revalidatePath("/[locale]/admin/editions", "page");
  // The landing page shelves and marks the editions from the cached editions metadata.
  revalidatePath("/[locale]", "page");
  // Visitor chapter fetches are cached for an hour; signed-in ones are not cached.
  if (field === "reader_full_text") revalidatePath("/[locale]/read/[edition]/[book]/[chapter]", "page");
  return { ok: true };
}
