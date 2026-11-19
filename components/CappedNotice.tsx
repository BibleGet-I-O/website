import { getTranslations } from "next-intl/server";
import type { AccessInfo } from "@/lib/access";
import { SignInButton } from "@/components/SignInButton";

export type NoticeKind = "signIn" | "verify" | "unavailable";

/**
 * Why a chapter stops early, by who is reading. With the reader key a chapter is capped only when the
 * admin has switched the edition's full text off, which no sign-in can change.
 */
export function noticeFor(truncated: boolean, a: AccessInfo): NoticeKind | null {
  if (!truncated) return null;
  if (a.access === "reader") return "unavailable";
  return a.signedIn ? "verify" : "signIn";
}

export async function CappedNotice({ kind, redirectTo }: { kind: NoticeKind; redirectTo: string }) {
  const t = await getTranslations("Notice");
  return (
    <aside role="note" className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950">
      <p>{t(kind)}</p>
      {/* Awaited, not <SignInButton />: one async component, so it also renders outside the RSC runtime (tests). */}
      {kind === "signIn" && <div className="mt-3">{await SignInButton({ redirectTo })}</div>}
    </aside>
  );
}
