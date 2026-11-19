import { getTranslations } from "next-intl/server";
import { getApiVersion } from "@/lib/api";
import { RELEASE } from "@/lib/release";

/** The site footer: the endpoint's release (when it reports one) and, in small text, the site's own. */
export async function SiteFooter() {
  const t = await getTranslations("Footer");
  const apiVersion = await getApiVersion();
  return (
    <footer className="mt-auto border-t border-slate-200 px-4 py-3 text-center text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
      {apiVersion && <p>{t("apiVersion", { version: apiVersion })}</p>}
      <p className="text-xs text-slate-500 dark:text-slate-500">{t("siteRelease", { release: RELEASE })}</p>
    </footer>
  );
}
