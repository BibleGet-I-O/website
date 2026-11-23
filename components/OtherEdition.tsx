"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

/**
 * A link to a passage in another edition than the note's (CEI 2008's notes cite the Nova Vulgata): the citation as
 * printed, then a small book, as Wikipedia marks an external link with an arrow; this one stays on the site and
 * opens another Bible. Its tooltip and accessible name say which.
 */
export function OtherEditionLink({ href, name, className, children }: { href: string; name: string; className?: string; children: ReactNode }) {
  const t = useTranslations("Notes");
  return (
    <a href={href} title={t("inEdition", { edition: name })} className={className}>
      {children}
      <svg className="bg-other-edition" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M2.5 2.75A1.75 1.75 0 0 1 4.25 1H13v11H4.25a.75.75 0 0 0 0 1.5H13V15H4.25A1.75 1.75 0 0 1 2.5 13.25Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
      <span className="sr-only"> ({t("inEditionShort", { edition: name })})</span>
    </a>
  );
}
