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
import { estherTradition, hasBothEstherTexts, type Tradition } from "@/lib/esther";
import { compareQuery, parseView, parseWith } from "@/lib/compare";
import { loadSecond } from "@/lib/interlinear";
import { buildRows } from "@/lib/parallel";
import { placeAsPrinted } from "@/lib/placement";
import { Spread } from "@/components/Spread";
import { TraditionSwitch } from "@/components/TraditionSwitch";
import type { Chapter, EditionIndex, VerseRow } from "@/lib/types";

type Params = { locale: string; edition: string; book: string; chapter: string };
type Search = { with?: string | string[]; view?: string | string[]; tradition?: string | string[] };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * A neighbouring verse an edition may print in this chapter. Its absence only costs that verse, so a failed
 * fetch shows the chapter without it (logged with the status only).
 */
async function masoreticText(
  printed: (t: Tradition) => Promise<{ rows: VerseRow[]; truncated: boolean }>,
): Promise<{ rows: VerseRow[]; truncated: boolean } | "unavailable"> {
  try {
    return await printed("HEBREW");
  } catch (err) {
    if (!(err instanceof ApiUnavailable)) throw err;
    // ApiUnavailable messages carry the status, never the URL or key.
    console.error(`[chapter] Masoretic text unavailable (${err.message})`);
    return "unavailable";
  }
}

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
  // Esther in an edition with both texts: read alone, both are shown side by side; comparing, one is chosen.
  const twoTexts = hasBothEstherTexts(book) && withSiglas.length === 0;
  const tradition = estherTradition(book, twoTexts ? undefined : one(search.tradition));

  const info = await getAccess();
  /**
   * The chapter as the edition prints it, in one of Esther's texts or the book's only one. An edition may
   * print the previous chapter's last verse at the start of this one (NABRE John 7:53 opens John 8) and the
   * next chapter's first verse at the end of this one (NABRE Wis 12:1 closes Wis 11).
   */
  const printed = async (text?: Tradition): Promise<{ rows: VerseRow[]; truncated: boolean }> => {
    const request = { sigla: edition.sigla, bookAbbrev: book.abbrev, access: info.access, ...(text && { tradition: text }) };
    const counts = text === "GREEK" && book.greekVersesPerChapter ? book.greekVersesPerChapter : book.versesPerChapter;
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
    return { rows: placeAsPrinted(prevLast, current.rows, nextFirst, chapter), truncated: current.truncated };
  };
  const main = await printed(twoTexts ? "GREEK" : tradition);
  const rows = main.rows;
  // The Masoretic text beside the Septuagint; when it cannot be loaded, the Septuagint alone with a note.
  const masoretic = twoTexts ? await masoreticText(printed) : null;
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

  const qs = compareQuery({ with: withSiglas, view, tradition, twoTexts });
  const base = `/read/${editionSlug(edition.sigla)}`;
  // Each text stops at its own cap; one notice tells it.
  const capped = main.truncated || (typeof masoretic === "object" && masoretic !== null && masoretic.truncated);
  const notice = noticeFor(capped, info, edition.copyright);
  const redirectTo = `/${locale}${base}/${slugFor(book, index.books)}/${chapter}${qs}`;
  const t = await getTranslations("Reader");
  // Columns need room (one per edition in the spread; the others go below); interlinear reads at a single
  // edition's width.
  const columns = twoTexts && masoretic !== "unavailable" ? 2 : 1 + seconds.filter((x) => x.mode === "aligned").length;
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
        esther={hasBothEstherTexts(book)}
        tradition={tradition}
      />
      {tradition && compared.length > 0 && await TraditionSwitch({
        tradition,
        hrefFor: (t) => `${base}/${slugFor(book, index.books)}/${chapter}${compareQuery({ with: withSiglas, view, tradition: t })}`,
      })}
      {masoretic && masoretic !== "unavailable" ? (
        <article>
          <h1 className="mb-6 text-center text-3xl font-semibold">{t("heading", { book: book.name, chapter })}</h1>
          <Spread
            sides={[
              { sigla: edition.sigla, name: edition.fullname, lang: edition.language || undefined, rubric: { full: t("septuagint"), short: t("septuagintShort") } },
              { sigla: `${edition.sigla}-MT`, name: edition.fullname, lang: edition.language || undefined, rubric: { full: t("masoretic"), short: t("masoreticShort") } },
            ]}
            rows={buildRows(rows, [masoretic.rows], book.bookNum)}
            chapter={chapter}
            truncated={[main.truncated, masoretic.truncated]}
            view={view}
            gapNotes={false}
          />
        </article>
      ) : masoretic === "unavailable" ? (
        <>
          <BookPage heading={t("heading", { book: book.name, chapter })} chapter={chapter} rows={rows} lang={edition.language || undefined} />
          <p role="note" className="my-4 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
            {t("secondUnavailable", { second: t("masoretic") })}
          </p>
        </>
      ) : compared.length > 0 ? (
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
          truncated: main.truncated,
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
