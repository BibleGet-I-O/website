import { useTranslations } from "next-intl";
import { WhyLink } from "@/components/WhyLink";

/** The editorial note on the empty side of a one-sided row: the edition has no such verse; "Why?" opens the explanation. */
export function GapNote({ edition }: { edition: string }) {
  const t = useTranslations("Reader");
  return <p className="ml-10 font-sans text-sm italic text-slate-500 dark:text-slate-400">[{t("gapAbsent", { edition })}]<WhyLink topic="missing-verses" short /></p>;
}
