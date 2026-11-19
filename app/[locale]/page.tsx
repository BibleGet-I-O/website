import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getEditions } from "@/lib/api";
import type { Edition } from "@/lib/types";
import BookCover from "@/components/BookCover";

/** The language's name in the UI locale, capitalised ("italiano" → "Italiano"); the code if unknown. */
function languageName(code: string, locale: string): string {
  let name = code;
  try {
    name = new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
  } catch {
    // An empty or malformed code: show it as it is.
  }
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
}

/** A safe fragment id for a language section. */
const sectionId = (code: string) => `lang-${code.replace(/[^A-Za-z0-9_-]/g, "") || "unknown"}`;

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const editions = await getEditions();

  const byLanguage = new Map<string, Edition[]>();
  for (const e of editions) byLanguage.set(e.language, [...(byLanguage.get(e.language) ?? []), e]);
  const groups = [...byLanguage.entries()]
    .map(([code, list]) => ({
      code,
      id: sectionId(code),
      name: languageName(code, locale),
      list: [...list].sort((a, b) => a.year.localeCompare(b.year, undefined, { numeric: true }) || a.fullname.localeCompare(b.fullname, locale)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <h1 className="text-center font-serif text-3xl font-semibold">{t("title")}</h1>
      <p className="mt-2 text-center text-slate-600 dark:text-slate-400">{t("intro")}</p>
      <nav aria-label={t("languages")} className="mt-6">
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2">
          {groups.map((g) => (
            <li key={g.code}>
              <a
                href={`#${g.id}`}
                className="rounded px-1 text-[#8b1a1f] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b1a1f] dark:text-[#e9c46a] dark:focus-visible:outline-[#e9c46a]"
              >
                {g.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {groups.map((g) => (
        <section key={g.code} id={g.id} className="mt-10 scroll-mt-6" aria-labelledby={`${g.id}-heading`}>
          <h2 id={`${g.id}-heading`} className="text-center font-serif text-2xl font-semibold">
            {g.name}
          </h2>
          <div className="mt-2 flex flex-wrap items-end justify-center gap-6 border-b-[10px] border-[#6b4a2e] px-4 pt-6 pb-4 dark:border-[#4a3322]">
            {g.list.map((e) => (
              <BookCover key={e.sigla} edition={e} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
