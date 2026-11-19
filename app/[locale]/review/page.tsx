import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getIndex } from "@/lib/api";
import { reviewGet, type ReviewChapterSummary, type ReviewEdition } from "@/lib/review";
import { editionSlug } from "@/lib/slug";

type Search = { edition?: string | string[] };

/**
 * The review of the links from editions' verses to CBTUDR units (role bibleget_reviewer): each edition's
 * counts, then, for the edition chosen (?edition=), its chapters with drafts, the least confident first.
 */
export default async function ReviewPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Search> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || session.error || session.reviewer !== true) notFound();

  const t = await getTranslations("Review");
  const raw = (await searchParams).edition;
  const chosen = (Array.isArray(raw) ? raw[0] : raw)?.toUpperCase();
  const editions = await reviewGet<{ editions: ReviewEdition[] }>("/editions");
  const edition = "data" in editions ? editions.data.editions.find((e) => e.edition === chosen) : undefined;
  const chapters = edition ? await reviewGet<{ chapters: ReviewChapterSummary[] }>(`/editions/${edition.edition}/chapters`) : null;
  const names = new Map<number, string>();
  if (edition) {
    try {
      for (const b of (await getIndex(edition.edition)).books) names.set(b.bookNum, b.name);
    } catch {
      // Book numbers stand in for names.
    }
  }
  const error = (e: "signIn" | "failed" | "notFound") => (
    <p role="alert" className="mt-6 text-red-700 dark:text-red-400">{e === "signIn" ? t("signInAgain") : t("listFailed")}</p>
  );

  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <Link href="/" className="text-sm text-slate-600 underline dark:text-slate-400">{t("back")}</Link>
      <h1 className="mt-2 text-3xl font-semibold">{t("title")}</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-400">{t("intro")}</p>
      {"error" in editions ? (
        error(editions.error)
      ) : (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-300 dark:border-slate-700">
              <th className="py-2">{t("edition")}</th>
              <th>{t("drafts")}</th>
              <th>{t("reviewed")}</th>
              <th>{t("byRule")}</th>
            </tr>
          </thead>
          <tbody>
            {editions.data.editions.map((e) => (
              <tr key={e.edition} className="border-b border-slate-200 dark:border-slate-800">
                <td className="py-2">
                  <Link href={`/review?edition=${editionSlug(e.edition)}`} className="font-medium underline">{e.edition}</Link>
                </td>
                <td>{e.draft}</td>
                <td>{e.reviewed}</td>
                <td>{e.rule}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {edition && chapters && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">{t("chaptersOf", { edition: edition.edition })}</h2>
          {"error" in chapters ? (
            error(chapters.error)
          ) : chapters.data.chapters.length === 0 ? (
            <p className="mt-2">{t("nothing")}</p>
          ) : (
            <ul aria-label={t("chapters")} className="mt-3 space-y-1">
              {[...chapters.data.chapters]
                .sort((a, b) => a.min_confidence - b.min_confidence || a.book - b.book || a.chapter - b.chapter)
                .map((c) => (
                  <li key={`${c.book}-${c.chapter}`}>
                    <Link href={`/review/${editionSlug(edition.edition)}/${c.book}/${c.chapter}`} className="underline">
                      {t("chapterLine", {
                        name: `${names.get(c.book) ?? c.book} ${c.chapter}`,
                        drafts: c.drafts,
                        percent: Math.round(c.min_confidence * 100),
                      })}
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
