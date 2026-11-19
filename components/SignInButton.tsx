import { getLocale, getTranslations } from "next-intl/server";
import { signIn } from "@/auth";

const buttonClass = "rounded border border-slate-300 px-3 py-1 text-sm dark:border-slate-700";

/** A same-origin path, or the fallback: never an absolute or protocol-relative URL (open redirect). */
export function safeRedirect(path: unknown, fallback: string): string {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) {
    return fallback;
  }
  return path;
}

/** Signs in with Zitadel and comes back to `redirectTo` (default: the locale's home page). */
export async function SignInButton({ redirectTo, className = buttonClass }: { redirectTo?: string; className?: string }) {
  const t = await getTranslations("Auth");
  const locale = await getLocale();
  const fallback = `/${locale}`;
  return (
    <form
      action={async (formData: FormData) => {
        "use server";
        // The field is client-supplied, so it is checked again here.
        await signIn("zitadel", { redirectTo: safeRedirect(formData.get("redirectTo"), fallback) });
      }}
    >
      <input type="hidden" name="redirectTo" value={safeRedirect(redirectTo, fallback)} />
      <button type="submit" className={className}>
        {t("signIn")}
      </button>
    </form>
  );
}
