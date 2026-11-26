import { useTranslations } from "next-intl";
import styles from "@/components/docs/docs.module.css";

/** At the head of a page not yet written in the interface language: it says so, in that language, above the English. */
export function UntranslatedNotice() {
  const t = useTranslations("Docs");
  return <p className={`${styles.banner} mb-6`} role="note">{t("untranslated")}</p>;
}
