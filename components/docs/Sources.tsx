import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/** A page's closing list of what it relies on, under a "Sources" heading (#sources) in the interface language. */
export function Sources({ children }: { children?: ReactNode }) {
  const t = useTranslations("Docs");
  return (
    <section aria-labelledby="sources">
      <h2 id="sources">
        <a href="#sources">{t("sources")}</a>
      </h2>
      {children}
    </section>
  );
}
