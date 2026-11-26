import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { whyHref, type WhyTopic } from "@/lib/docs";

const KEYS: Record<WhyTopic, "esther" | "missingVerses" | "psalmNumbering" | "printedElsewhere"> = {
  esther: "esther", "missing-verses": "missingVerses", "psalm-numbering": "psalmNumbering", "printed-elsewhere": "printedElsewhere",
};

/**
 * A small "why?" where the reader shows a difference between editions: it opens that section of *Why editions differ*.
 * An ⓘ, or the word itself (`short`) where there is room; muted, red on hover; named and titled for the question it answers.
 */
export function WhyLink({ topic, short = false }: { topic: WhyTopic; short?: boolean }) {
  const t = useTranslations("Reader.why");
  const label = t(KEYS[topic]);
  return (
    <Link
      href={whyHref(topic)}
      aria-label={label}
      title={label}
      className="ml-1 inline-flex items-center align-middle font-sans text-xs font-normal not-italic normal-case tracking-normal text-slate-500 no-underline hover:text-red-700 dark:text-slate-400 dark:hover:text-red-400"
    >
      {short ? (
        t("short")
      ) : (
        <svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 7.25v4M8 4.75v.5" strokeLinecap="round" />
        </svg>
      )}
    </Link>
  );
}
