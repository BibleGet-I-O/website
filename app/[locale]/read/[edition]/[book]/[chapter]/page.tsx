import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { BookPage } from "@/components/BookPage";
import { CappedNotice, noticeFor } from "@/components/CappedNotice";
import { ChapterNav } from "@/components/ChapterNav";
import { editionSlug } from "@/lib/slug";
import { ReaderBar } from "@/components/ReaderBar";
import { Interlinear } from "@/components/Interlinear";
import { getAccess } from "@/lib/access";
import { ApiUnavailable, bookBySlug, getChapter, getEditions, getIndex, getVerses, NotFound, slugFor } from "@/lib/api";
import { estherTradition } from "@/lib/esther";
import { compareQuery, parseView, parseWith } from "@/lib/compare";
import { loadSecond } from "@/lib/interlinear";
import { placeAsPrinted } from "@/lib/placement";
import type { Chapter, EditionIndex, VerseRow } from "@/lib/types";

type Params = { locale: string; edition: string; book: string; chapter: string };
type Search = { with?: string | string[]; view?: string | string[]; tradition?: string | string[] };

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

  const withSiglas = parseWith(one(search.with), edition.sigla, editions.map((e) => e.sigla));
  const view = parseView(one(search.view));
  const tradition = estherTradition(book, one(search.tradition));

  const info = await getAccess();
  const request = { sigla: edition.sigla, bookAbbrev: book.abbrev, access: info.access, ...(tradition && { tradition }) };
  // An edition may print the previous chapter's last verse at the start of this one (NABRE John 7:53 opens
  // John 8) and the next chapter's first verse at the end of this one (NABRE Wis 12:1 closes Wis 11).
  const counts = tradition === "GREEK" && book.greekVersesPerChapter ? book.greekVersesPerChapter : book.versesPerChapter;
  const prevVerses = chapter > 1 ? counts[chapter - 2] : undefined;
  const current: Chapter = await orNotFound(getChapter({ ...request, chapter }));
  // A capped chapter stops at verse 30: the previous chapter's last verse would make it 31 and the next
  // chapter's would not follow it, so neither is fetched.
  const prevLast: VerseRow[] =
    prevVerses && !current.truncated
      ? await neighbourVerse(getVerses({ ...request, chapter: chapter - 1, verse: prevVerses }))
      : [];
  const nextFirst =
    chapter < book.chapters && !current.truncated
      ? await neighbourVerse(getVerses({ ...request, chapter: chapter + 1, verse: 1 }))
      : [];
  const rows = placeAsPrinted(prevLast, current.rows, nextFirst, chapter);
  const compared = withSiglas.map((sigla) => editions.find((e) => e.sigla === sigla)!);
  // The compared editions read with the main one's access; one that cannot be reached degrades to a note
  // (it does not show the error page).
  const seconds = await Promise.all(
    compared.map((e) =>
      loadSecond({
        mainSigla: edition.sigla, mainBookAbbrev: book.abbrev, mainIndex: index, bookNum: book.bookNum, chapter,
        mainRows: rows, withSigla: e.sigla, access: info.access, tradition,
      }),
    ),
  );

  const qs = compareQuery({ with: withSiglas, view, tradition });
  const base = `/read/${editionSlug(edition.sigla)}`;
  const notice = noticeFor(current.truncated, info, edition.copyright);
  const redirectTo = `/${locale}${base}/${slugFor(book, index.books)}/${chapter}${qs}`;
  const t = await getTranslations("Reader");
  // Columns need room (one per edition in the spread; the others go below); interlinear reads at a single
  // edition's width.
  const columns = 1 + seconds.filter((x) => x.mode === "aligned").length;
  const width = columns === 1 || view === "interlinear" ? "max-w-3xl" : columns === 2 ? "max-w-6xl" : "max-w-7xl";

  return (
    <main className={`mx-auto w-full ${width} p-4 sm:p-6`}>
      <ReaderBar
        locale={locale}
        edition={edition.sigla}
        editions={editions.map((e) => ({ sigla: e.sigla, fullname: e.fullname }))}
        books={index.books.map((b) => ({ slug: slugFor(b, index.books), name: b.name, chapters: b.chapters }))}
        book={slugFor(book, index.books)}
        bookNum={book.bookNum}
        chapter={chapter}
        withSiglas={withSiglas}
        view={view}
        esther={tradition !== undefined}
        tradition={tradition}
      />
      {compared.length > 0 ? (
        await Interlinear({
          heading: t("heading", { book: book.name, chapter }),
          main: { sigla: edition.sigla, name: edition.fullname, lang: edition.language || undefined },
          others: compared.map((e, i) => {
            const second = seconds[i];
            return {
              side: { sigla: e.sigla, name: e.fullname, lang: e.language || undefined },
              second,
              // A compared edition's cap, told the same way as the main one's.
              notice: second.mode === "aligned" || second.mode === "whole-chapter" ? noticeFor(second.truncated, info, e.copyright) : null,
            };
          }),
          rows,
          bookNum: book.bookNum,
          bookName: book.name,
          chapter,
          truncated: current.truncated,
          view,
          redirectTo,
        })
      ) : (
        <BookPage heading={t("heading", { book: book.name, chapter })} chapter={chapter} rows={rows} lang={edition.language || undefined} />
      )}
      {notice && await CappedNotice({ kind: notice, redirectTo, ...(compared.length > 0 && { edition: edition.fullname }) })}
      {await ChapterNav({ index, bookNum: book.bookNum, chapter, base, query: qs })}
    </main>
  );
}
