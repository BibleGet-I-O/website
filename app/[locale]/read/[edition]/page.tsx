import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { editionSlug } from "@/components/EditionCard";
import { getEditions, getIndex, NotFound, slugFor } from "@/lib/api";
import type { Book } from "@/lib/types";

/** Catholic canon numbering: books 1-46 are the Old Testament, 47-73 the New. */
const LAST_OT_BOOK = 46;

export default async function BooksPage({ params }: { params: Promise<{ locale: string; edition: string }> }) {
  const { locale, edition: editionParam } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const edition = (await getEditions()).find((e) => editionSlug(e.sigla) === editionParam.toLowerCase());
  if (!edition) notFound();
  let books: Book[];
  try {
    books = (await getIndex(edition.sigla)).books;
  } catch (err) {
    if (err instanceof NotFound) notFound();
    throw err;
  }

  const t = await getTranslations("Books");
  const groups = [
    { key: "ot", title: t("ot"), books: books.filter((b) => b.bookNum <= LAST_OT_BOOK) },
    { key: "nt", title: t("nt"), books: books.filter((b) => b.bookNum > LAST_OT_BOOK) },
  ].filter((g) => g.books.length > 0);
  const base = `/read/${editionSlug(edition.sigla)}`;

  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <Link href="/" className="text-sm text-slate-600 underline dark:text-slate-400">
        {t("allEditions")}
      </Link>
      <h1 className="mt-2 text-3xl font-semibold">{edition.fullname}</h1>
      <p className="text-slate-600 dark:text-slate-400">{[edition.year, edition.copyrightHolder].filter(Boolean).join(" · ")}</p>
      {groups.map((g) => (
        <section key={g.key} className="mt-8">
          <h2 className="mb-3 text-xl font-semibold">{g.title}</h2>
          <ul className="space-y-4">
            {g.books.map((b) => (
              <li key={b.bookNum}>
                <h3 className="font-medium">{b.name}</h3>
                <ul className="mt-1 flex flex-wrap gap-1" aria-label={t("chapters", { book: b.name })}>
                  {Array.from({ length: b.chapters }, (_, i) => i + 1).map((n) => (
                    <li key={n}>
                      <Link
                        href={`${base}/${slugFor(b, books)}/${n}`}
                        className="block min-w-9 rounded border border-slate-200 px-2 py-1 text-center text-sm hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
                      >
                        {n}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
