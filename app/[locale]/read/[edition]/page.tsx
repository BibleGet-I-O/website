import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { SearchLens, SearchPanel, SearchPanelProvider } from "@/components/SearchForm";
import { editionSlug } from "@/lib/slug";
import { getEditions, getIndex, NotFound, slugFor } from "@/lib/api";
import type { Book } from "@/lib/types";
import { groupBySection } from "@/lib/sections";
import { chapterNumbers, hasChapter, PROLOGUE } from "@/lib/chapters";

/** Catholic canon numbering: books 1-46 are the Old Testament, 47-73 the New. */
const LAST_OT_BOOK = 46;

type Search = { book?: string | string[]; chapter?: string | string[]; with?: string | string[]; view?: string | string[]; tradition?: string | string[] };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const whole = (v: string | undefined) => (v !== undefined && /^(0|[1-9]\d*)$/.test(v) ? Number(v) : undefined);

/**
 * The reader's `with`, `view` and `tradition`, passed on as they came (the chapter page checks them), the
 * commas of `with` kept literal: "" or "?…".
 */
function passOn(search: Search): string {
  const qs = (["with", "view", "tradition"] as const)
    .map((k) => [k, one(search[k])] as const)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v!).replace(/%2C/gi, ",")}`)
    .join("&");
  return qs ? `?${qs}` : "";
}

/**
 * The chapter the reader was on in another edition (`?book={bookNum}&chapter=`, from the reader bar's edition
 * switch), in this one: its path, with the reader's choices passed on, or null when this edition lacks the
 * book (a deuterocanonical book in a Protestant canon) or the chapter.
 */
function sameChapter(base: string, books: Book[], search: Search): string | null {
  const bookNum = whole(one(search.book));
  const asked = whole(one(search.chapter));
  const b = bookNum === undefined ? undefined : books.find((x) => x.bookNum === bookNum);
  if (!b || asked === undefined) return null;
  // Sirach's prologue in an edition that does not print it: its chapter 1, which follows it.
  const chapter = asked === PROLOGUE && !hasChapter(b, PROLOGUE) ? 1 : asked;
  if (!hasChapter(b, chapter)) return null;
  return `${base}/${slugFor(b, books)}/${chapter}${passOn(search)}`;
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
  const search = (await searchParams) ?? {};
  const target = sameChapter(base, books, search);
  if (target) redirect(`/${locale}${target}`);
  // Where the edition lacks the chapter, its chapters keep the comparison too.
  const query = passOn(search);

  const t = await getTranslations("Books");
  const tg = await getTranslations("GoTo");
  const groups = [
    { key: "ot", title: t("ot"), books: books.filter((b) => b.bookNum <= LAST_OT_BOOK) },
    { key: "nt", title: t("nt"), books: books.filter((b) => b.bookNum > LAST_OT_BOOK) },
  ].filter((g) => g.books.length > 0);

  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <SearchPanelProvider locale={locale} edition={edition.sigla} editionName={edition.fullname} from={`/${locale}${base}${query}`}>
        <div className="flex items-center justify-between gap-4">
          {/* Back to the shelf, as in the Martyrology reader. */}
          <Link href="/" className="text-sm text-slate-600 underline dark:text-slate-400">
            <span aria-hidden>⟵ </span>
            {t("allEditions")}
          </Link>
          {/* Search runs over the whole edition, so it is offered before a chapter is chosen. */}
          <SearchLens />
        </div>
        <SearchPanel className="mt-3" />
      </SearchPanelProvider>
      <h1 className="mt-2 text-3xl font-semibold">{edition.fullname}</h1>
      <p className="text-slate-600 dark:text-slate-400">{[edition.year, edition.copyrightHolder].filter(Boolean).join(" · ")}</p>
      {groups.map((g) => (
        <section key={g.key} className="mt-8">
          <h2 className="mb-3 text-xl font-semibold">{g.title}</h2>
          {/* By section, each book folded: short on a phone, and every chapter still a link in the page. */}
          {groupBySection(g.books).map((s) => (
            <div key={s.key} className="mb-5">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400">{tg(`sections.${s.key}`)}</h3>
              <ul className="divide-y divide-slate-200 rounded border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {s.books.map((b) => (
                  <li key={b.bookNum}>
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 font-medium">
                        <span>{b.name}</span>
                        <span className="text-sm font-normal text-slate-500 dark:text-slate-400">{b.chapters}</span>
                      </summary>
                      <ul className="flex flex-wrap gap-1 px-3 pb-3" aria-label={t("chapters", { book: b.name })}>
                        {chapterNumbers(b).map((n) => (
                          <li key={n}>
                            <Link
                              href={`${base}/${slugFor(b, books)}/${n}${query}`}
                              aria-label={n === PROLOGUE ? tg("prologue") : undefined}
                              className="block min-w-9 rounded border border-slate-200 px-2 py-1 text-center text-sm hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
                            >
                              {n === PROLOGUE ? tg("prologueShort") : n}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
