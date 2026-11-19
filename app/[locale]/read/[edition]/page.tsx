import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { editionSlug } from "@/lib/slug";
import { getEditions, getIndex, NotFound, slugFor } from "@/lib/api";
import type { Book } from "@/lib/types";

/** Catholic canon numbering: books 1-46 are the Old Testament, 47-73 the New. */
const LAST_OT_BOOK = 46;

type Search = { book?: string | string[]; chapter?: string | string[]; with?: string | string[]; view?: string | string[]; tradition?: string | string[] };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const positive = (v: string | undefined) => (v !== undefined && /^[1-9]\d*$/.test(v) ? Number(v) : undefined);

/**
 * The chapter the reader was on in another edition (`?book={bookNum}&chapter=`, from the reader bar's edition
 * switch), in this one: its path, with `with`, `view` and `tradition` passed on (the chapter page checks them), or null
 * when this edition lacks the book (a deuterocanonical book in a Protestant canon) or the chapter.
 */
function sameChapter(base: string, books: Book[], search: Search): string | null {
  const bookNum = positive(one(search.book));
  const chapter = positive(one(search.chapter));
  const b = bookNum === undefined ? undefined : books.find((x) => x.bookNum === bookNum);
  if (!b || chapter === undefined || chapter > b.chapters) return null;
  // Passed on as they came (the chapter page checks them), the commas of `with` kept literal.
  const qs = (["with", "view", "tradition"] as const)
    .map((k) => [k, one(search[k])] as const)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v!).replace(/%2C/gi, ",")}`)
    .join("&");
  return `${base}/${slugFor(b, books)}/${chapter}${qs ? `?${qs}` : ""}`;
}

export default async function BooksPage({ params, searchParams }: { params: Promise<{ locale: string; edition: string }>; searchParams?: Promise<Search> }) {
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

  const base = `/read/${editionSlug(edition.sigla)}`;
  const target = sameChapter(base, books, (await searchParams) ?? {});
  if (target) redirect(`/${locale}${target}`);

  const t = await getTranslations("Books");
  const groups = [
    { key: "ot", title: t("ot"), books: books.filter((b) => b.bookNum <= LAST_OT_BOOK) },
    { key: "nt", title: t("nt"), books: books.filter((b) => b.bookNum > LAST_OT_BOOK) },
  ].filter((g) => g.books.length > 0);

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
