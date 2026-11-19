import { useTranslations } from "next-intl";

/** The editorial note on the empty side of a one-sided row: the edition has no such verse. */
export function GapNote({ edition }: { edition: string }) {
  const t = useTranslations("Reader");
  return <p className="ml-10 font-sans text-sm italic text-slate-500 dark:text-slate-400">[{t("gapAbsent", { edition })}]</p>;
}
