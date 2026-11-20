import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Tradition } from "@/lib/esther";

const rubric = "font-sans text-xs font-semibold uppercase tracking-wide";

/**
 * Esther's two texts, when comparing editions: every edition shows the same one, and this switch, in red
 * rubric above the columns, picks it. `hrefFor` gives the locale-less link for each text.
 */
export async function TraditionSwitch({ tradition, hrefFor }: { tradition: Tradition; hrefFor: (t: Tradition) => string }) {
  const t = await getTranslations("Reader");
  const item = (value: Tradition, label: string) => {
    const current = value === tradition;
    return (
      <Link
        href={hrefFor(value)}
        aria-current={current ? "true" : undefined}
        className={`${rubric} rounded px-2 py-1 ${current ? "text-red-700 underline underline-offset-4 dark:text-red-400" : "text-red-700/70 hover:text-red-700 dark:text-red-400/70 dark:hover:text-red-400"}`}
      >
        {label}
      </Link>
    );
  };
  return (
    <nav aria-label={t("estherText")} className="mb-4 flex items-center justify-center gap-1">
      {item("GREEK", t("septuagint"))}
      <span aria-hidden="true" className="text-red-700/50 dark:text-red-400/50">|</span>
      {item("HEBREW", t("masoretic"))}
    </nav>
  );
}
