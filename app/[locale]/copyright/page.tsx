import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { EDITION_RIGHTS } from "@/lib/edition-rights";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale, namespace: "Copyright" });
  return { title: t("title") };
}

/**
 * The editions quoted by permission, each with the notice its permission asks for, quoted as the agreement states
 * it and in its own language. Each section is linkable by its sigla (/{locale}/copyright#nabre).
 */
export default async function CopyrightPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Copyright");

  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      <p className="mt-3 text-slate-700 dark:text-slate-300">{t("intro")}</p>
      {EDITION_RIGHTS.map((e) => (
        <section key={e.id} id={e.id} className="mt-8 scroll-mt-4">
          <h2 className="text-xl font-semibold">
            <span lang={e.lang}>{e.title}</span> <span className="text-slate-500 dark:text-slate-400">({e.sigla})</span>
          </h2>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="font-semibold">{t("holder")}</dt>
            <dd>{e.holder}</dd>
            <dt className="font-semibold">{t("permission")}</dt>
            <dd>{t(`permissions.${e.id}`)}</dd>
            {e.source && (
              <>
                <dt className="font-semibold">{t("source")}</dt>
                <dd className="break-all">
                  <a href={e.source} className="underline">{e.source}</a>
                </dd>
              </>
            )}
          </dl>
          <h3 className="mt-4 text-sm font-semibold">{t("notice")}</h3>
          <blockquote lang={e.lang} className="mt-1 border-l-4 border-slate-300 pl-3 font-serif dark:border-slate-700">
            {e.notice}
          </blockquote>
          {e.approvals?.map((a) => (
            <div key={a.heading} lang={e.lang} className="mt-4">
              <h3 className="text-sm font-semibold">{a.heading}</h3>
              {a.lines.map((line) => (
                <p key={line} className="mt-1 font-serif text-sm">{line}</p>
              ))}
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
