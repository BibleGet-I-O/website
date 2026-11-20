import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Tradition } from "@/lib/esther";

// Full red at both weights: small text needs 4.5:1, so the current text is marked by weight and underline.
const rubric = "font-sans text-xs uppercase tracking-wide";

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
        className={`${rubric} inline-flex min-h-8 items-center rounded px-2 text-red-700 dark:text-red-400 ${current ? "font-bold underline underline-offset-4" : "font-normal hover:underline"}`}
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
