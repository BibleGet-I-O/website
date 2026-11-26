import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { DocsNav } from "@/components/docs/DocsNav";

/** The docs' frame: the sidebar in the interface language beside the page (each page sets its article's language). */
export default async function DocsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6 sm:flex-row sm:gap-10">
      <DocsNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
