import { useTranslations } from "next-intl";
import styles from "@/components/docs/docs.module.css";

/** The CBTUDR banner: every textual-unit identifier is a draft until the registry's v1.0.0, in the interface language. */
export function Drafts() {
  const t = useTranslations("Docs");
  return <p className={`${styles.banner} my-4`} role="note">{t("drafts")}</p>;
}
