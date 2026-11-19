import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { unstable_rethrow } from "next/navigation";
import { auth, signOut } from "@/auth";
import { Link } from "@/i18n/navigation";
import { SignInButton } from "@/components/SignInButton";
import { RETURN_TO_HEADER } from "@/lib/return-to";

const buttonClass = "rounded border border-slate-300 px-3 py-1 text-sm dark:border-slate-700";

/** The header's sign-in state: the user's email and a sign-out button, or a sign-in button. */
export async function AuthStatus() {
  const t = await getTranslations("Auth");
  const locale = await getLocale();
  // Never let an auth backend problem blank the header on every page.
  let session = null;
  try {
    session = await auth();
  } catch (err) {
    unstable_rethrow(err);
    console.warn(`[AuthStatus] could not read the session; rendering signed out (${err instanceof Error ? err.name : "error"})`);
  }

  // Awaited, not <SignInButton />: one async component, so it also renders outside the RSC runtime (tests).
  if (!session?.user || session.error) {
    // Back to this page after sign-in; SignInButton falls back to the home page for anything unsafe.
    const redirectTo = (await headers()).get(RETURN_TO_HEADER) ?? undefined;
    return SignInButton({ redirectTo });
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      {session.admin === true && (
        <Link href="/admin/editions" className="underline">
          {t("admin")}
        </Link>
      )}
      <span>{session.user.email ?? session.user.name}</span>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: `/${locale}` });
        }}
      >
        <button type="submit" className={buttonClass}>
          {t("signOut")}
        </button>
      </form>
    </div>
  );
}
