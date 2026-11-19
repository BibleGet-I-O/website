import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { BookPage } from "@/components/BookPage";
import { CappedNotice, noticeFor } from "@/components/CappedNotice";
import { ChapterNav } from "@/components/ChapterNav";
import { editionSlug } from "@/components/EditionCard";
import { ReaderBar } from "@/components/ReaderBar";
import { getAccess } from "@/lib/access";
import { ApiUnavailable, bookBySlug, getChapter, getEditions, getIndex, getVerses, NotFound, slugFor } from "@/lib/api";
import { estherTradition } from "@/lib/esther";
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

  const query = new URLSearchParams();
  if (withSigla) query.set("with", withSigla);
  if (tradition === "HEBREW") query.set("tradition", tradition);
  const qs = query.size > 0 ? `?${query}` : "";
  const base = `/read/${editionSlug(edition.sigla)}`;
  const notice = noticeFor(current.truncated, info);
  const t = await getTranslations("Reader");

  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
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
      <BookPage heading={t("heading", { book: book.name, chapter })} chapter={chapter} rows={rows} lang={edition.language || undefined} />
      {notice && await CappedNotice({ kind: notice, redirectTo: `/${locale}${base}/${slugFor(book)}/${chapter}${qs}` })}
      {await ChapterNav({ index, bookNum: book.bookNum, chapter, base, query: qs })}
    </main>
  );
}
