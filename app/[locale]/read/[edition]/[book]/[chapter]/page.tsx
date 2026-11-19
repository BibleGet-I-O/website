import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { BookPage } from "@/components/BookPage";
import { CappedNotice, noticeFor } from "@/components/CappedNotice";
import { ChapterNav } from "@/components/ChapterNav";
import { editionSlug } from "@/components/EditionCard";
import { ReaderBar } from "@/components/ReaderBar";
import { Spread } from "@/components/Spread";
import { VerseLines } from "@/components/VerseLines";
import { getAccess } from "@/lib/access";
import { ApiUnavailable, bookBySlug, getChapter, getEditions, getIndex, getVerses, NotFound, slugFor } from "@/lib/api";
import { estherTradition } from "@/lib/esther";
import { loadSecond, type Second } from "@/lib/interlinear";
import { buildRows } from "@/lib/parallel";
import { placeAsPrinted } from "@/lib/placement";
import type { Chapter, EditionIndex, VerseRow } from "@/lib/types";

type Params = { locale: string; edition: string; book: string; chapter: string };
type Search = { with?: string | string[]; tradition?: string | string[] };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * A neighbouring verse an edition may print in this chapter. Its absence only costs that verse, so a failed
 * fetch shows the chapter without it (logged with the status only).
 */
async function neighbourVerse(p: Promise<VerseRow[]>): Promise<VerseRow[]> {
  try {
    return await p;
  } catch (err) {
    if (err instanceof NotFound) return [];
    // ApiUnavailable messages carry the status ("endpoint answered 503"), never the URL or key.
    if (err instanceof ApiUnavailable) {
      console.error(`[chapter] neighbouring verse unavailable (${err.message})`);
      return [];
    }
    throw err;
  }
}

/** NotFound from the endpoint means a page that does not exist: a 404, never a 500. */
async function orNotFound<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (err) {
    if (err instanceof NotFound) notFound();
    throw err;
  }
}

export default async function ChapterPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { locale, edition: editionParam, book: bookParam, chapter: chapterParam } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const search = await searchParams;

  const editions = await getEditions();
  const edition = editions.find((e) => editionSlug(e.sigla) === editionParam.toLowerCase());
  if (!edition) notFound();
  const index: EditionIndex = await orNotFound(getIndex(edition.sigla));
  const book = bookBySlug(index, bookParam);
  if (!book) notFound();
  if (!/^[1-9]\d*$/.test(chapterParam)) notFound();
  const chapter = Number(chapterParam);
  if (chapter > book.chapters) notFound();

  const withParam = one(search.with)?.toUpperCase();
  const withSigla = editions.some((e) => e.sigla === withParam && e.sigla !== edition.sigla) ? withParam : undefined;
  const tradition = estherTradition(book, one(search.tradition));

  const info = await getAccess();
  const request = { sigla: edition.sigla, bookAbbrev: book.abbrev, access: info.access, ...(tradition && { tradition }) };
  // An edition may print the previous chapter's last verse at the start of this one (NABRE John 7:53 opens
  // John 8) and the next chapter's first verse at the end of this one (NABRE Wis 12:1 closes Wis 11).
  const counts = tradition === "GREEK" && book.greekVersesPerChapter ? book.greekVersesPerChapter : book.versesPerChapter;
  const prevVerses = chapter > 1 ? counts[chapter - 2] : undefined;
  const [current, prevLast]: [Chapter, VerseRow[]] = await Promise.all([
    orNotFound(getChapter({ ...request, chapter })),
    prevVerses ? neighbourVerse(getVerses({ ...request, chapter: chapter - 1, verse: prevVerses })) : Promise.resolve([]),
  ]);
  // A capped chapter stops at verse 30: the next chapter's verse would not follow it, so it is not fetched.
  const nextFirst =
    chapter < book.chapters && !current.truncated
      ? await neighbourVerse(getVerses({ ...request, chapter: chapter + 1, verse: 1 }))
      : [];
  const rows = placeAsPrinted(prevLast, current.rows, nextFirst, chapter);
  const secondEdition = withSigla ? editions.find((e) => e.sigla === withSigla) : undefined;
  // The second edition reads with the main one's access; a failure to reach it shows the error page.
  const second: Second | null = secondEdition
    ? await loadSecond({
        mainIndex: index, bookNum: book.bookNum, chapter, mainRows: rows, withSigla: secondEdition.sigla,
        access: info.access, tradition, prevLast, nextFirst,
      })
    : null;

  const query = new URLSearchParams();
  if (withSigla) query.set("with", withSigla);
  if (tradition === "HEBREW") query.set("tradition", tradition);
  const qs = query.size > 0 ? `?${query}` : "";
  const base = `/read/${editionSlug(edition.sigla)}`;
  const notice = noticeFor(current.truncated, info);
  const t = await getTranslations("Reader");

  return (
    <main className={`mx-auto w-full ${secondEdition ? "max-w-6xl" : "max-w-3xl"} p-4 sm:p-6`}>
      <ReaderBar
        locale={locale}
        edition={edition.sigla}
        editions={editions.map((e) => ({ sigla: e.sigla, fullname: e.fullname }))}
        books={index.books.map((b) => ({ slug: slugFor(b), name: b.name, chapters: b.chapters }))}
        book={slugFor(book)}
        chapter={chapter}
        withSigla={withSigla}
        esther={tradition !== undefined}
        tradition={tradition}
      />
      {secondEdition && second ? (
        <Interlinear
          heading={t("heading", { book: book.name, chapter })}
          main={{ sigla: edition.sigla, name: edition.fullname, lang: edition.language || undefined }}
          other={{ sigla: secondEdition.sigla, name: secondEdition.fullname, lang: secondEdition.language || undefined }}
          rows={rows}
          second={second}
          bookNum={book.bookNum}
          bookName={book.name}
          chapter={chapter}
          truncated={current.truncated}
          t={t}
        />
      ) : (
        <BookPage heading={t("heading", { book: book.name, chapter })} chapter={chapter} rows={rows} lang={edition.language || undefined} />
      )}
      {notice && await CappedNotice({ kind: notice, redirectTo: `/${locale}${base}/${slugFor(book)}/${chapter}${qs}` })}
      {await ChapterNav({ index, bookNum: book.bookNum, chapter, base, query: qs })}
    </main>
  );
}

type Side = { sigla: string; name: string; lang?: string };
type ReaderT = Awaited<ReturnType<typeof getTranslations<"Reader">>>;

const noteClass = "my-4 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900";

/** Interlinear on: verse per line, the second edition beside the main one, or below it when they cannot align. */
function Interlinear(p: {
  heading: string; main: Side; other: Side; rows: VerseRow[]; second: Second; bookNum: number; bookName: string;
  chapter: number; truncated: boolean; t: ReaderT;
}) {
  const { t, second, chapter } = p;
  const title = <h1 className="mb-6 text-center text-3xl font-semibold">{p.heading}</h1>;
  if (second.mode === "aligned") {
    return (
      <article>
        {title}
        <Spread a={p.main} b={p.other} rows={buildRows(p.rows, second.rows, p.bookNum)} chapter={chapter} aTruncated={p.truncated} />
      </article>
    );
  }
  return (
    <article>
      {title}
      <VerseLines rows={p.rows} chapter={chapter} lang={p.main.lang} />
      {second.mode === "missing" ? (
        <p role="note" className={noteClass}>{t("secondMissing", { second: p.other.name, book: p.bookName, chapter })}</p>
      ) : (
        <>
          <p role="note" className={noteClass}>{t("dividedDifferently", { main: p.main.name, second: p.other.name, chapter })}</p>
          <h2 className="mt-6 mb-1 text-center text-2xl font-semibold">{t("heading", { book: second.book?.name ?? p.bookName, chapter })}</h2>
          <p className="mb-4 text-center font-sans text-sm text-slate-600 dark:text-slate-400">{p.other.name}</p>
          <VerseLines rows={second.rows} chapter={chapter} lang={p.other.lang} />
        </>
      )}
    </article>
  );
}
