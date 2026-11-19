import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getEditions } from "@/lib/api";
import type { Edition } from "@/lib/types";
import { EditionCard } from "@/components/EditionCard";

function languageName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const editions = await getEditions();

  const byLanguage = new Map<string, Edition[]>();
  for (const e of editions) byLanguage.set(e.language, [...(byLanguage.get(e.language) ?? []), e]);
  const groups = [...byLanguage.entries()]
    .map(([code, list]) => ({ code, name: languageName(code, locale), list }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">{t("intro")}</p>
      {groups.map((g) => (
        <section key={g.code} className="mt-8">
          <h2 className="mb-3 text-xl font-semibold">{g.name}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {g.list.map((e) => (
              <EditionCard key={e.sigla} edition={e} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
