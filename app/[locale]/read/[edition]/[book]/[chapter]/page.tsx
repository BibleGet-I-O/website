import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { BookPage } from "@/components/BookPage";
import { CappedNotice, noticeFor } from "@/components/CappedNotice";
import { ChapterNav, chapterTargets } from "@/components/ChapterNav";
import { editionSlug } from "@/lib/slug";
import { ReaderBar } from "@/components/ReaderBar";
import { RememberChapter } from "@/components/RememberChapter";
import { Interlinear } from "@/components/Interlinear";
import { PageTurn } from "@/components/PageTurn";
import { getAccess } from "@/lib/access";
import { ApiUnavailable, bookBySlug, getChapter, getEditions, getIndex, getOutline, getVerses, NotFound, slugFor } from "@/lib/api";
import { ESTHER, estherTradition, hasBothEstherTexts, type Tradition } from "@/lib/esther";
import { compareQuery, comparisonFor, parseView, parseWith } from "@/lib/compare";
import { hasChapter, PROLOGUE } from "@/lib/chapters";
import { loadSecond } from "@/lib/interlinear";
import { buildRows } from "@/lib/parallel";
import { placeAsPrinted, verseAnchor } from "@/lib/placement";
import { Spread } from "@/components/Spread";
import { ChapterNotes, type NoteGroup } from "@/components/ChapterNotes";
import { chapterFootnotes, NOTE_EDITIONS } from "@/lib/notes";
import { editionsCited, withNoteLinks } from "@/lib/note-links";
import { TitleIndex } from "@/components/TitleIndex";
import { TraditionSwitch } from "@/components/TraditionSwitch";
import type { Chapter, EditionIndex, VerseRow } from "@/lib/types";

type Params = { locale: string; edition: string; book: string; chapter: string };
type Search = { with?: string | string[]; view?: string | string[]; tradition?: string | string[] };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * A neighbouring verse an edition may print in this chapter. Its absence only costs that verse, so a failed
 * fetch shows the chapter without it (logged with the status only).
 */
/**
 * Whether, in Esther, a compared edition prints both texts ("both"), none does ("none"), or that cannot be told
 * because an index could not be loaded ("unknown"). An edition the API does not know prints neither.
 */
async function comparedEstherTexts(bookNum: number, siglas: string[]): Promise<"both" | "none" | "unknown"> {
  if (bookNum !== ESTHER || siglas.length === 0) return "none";
  const each = await Promise.all(siglas.map(async (s) => {
    try {
      return (await getIndex(s)).books.some((b) => hasBothEstherTexts(b)) ? "both" : "none";
    } catch (err) {
      if (err instanceof NotFound) return "none";
      if (err instanceof ApiUnavailable) return "unknown";
      throw err;
    }
  }));
  return each.includes("both") ? "both" : each.includes("unknown") ? "unknown" : "none";
}

async function masoreticText(
  printed: (t: Tradition, chapterMissing: "404" | "throw") => Promise<{ rows: VerseRow[]; truncated: boolean }>,
): Promise<{ rows: VerseRow[]; truncated: boolean } | "unavailable"> {
  try {
    return await printed("HEBREW", "throw");
  } catch (err) {
    // The Septuagint has loaded: a Masoretic chapter the API cannot give (unavailable, or not found) leaves it
    // alone with a note, not a missing page.
    if (err instanceof ApiUnavailable) console.error(`[chapter] Masoretic text unavailable (${err.message})`);
    else if (!(err instanceof NotFound)) throw err;
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
  // Chapter 0 is Sirach's prologue, in an edition that prints it.
  if (!/^(0|[1-9]\d*)$/.test(chapterParam)) notFound();
  const chapter = Number(chapterParam);
  if (!hasChapter(book, chapter)) notFound();

  const withSiglas = parseWith(one(search.with), edition.sigla, editions.map((e) => e.sigla));
  const view = parseView(one(search.view));
  // Esther in an edition with both texts: read alone, both are shown side by side; comparing, one is chosen.
  const twoTexts = hasBothEstherTexts(book) && withSiglas.length === 0;
  // The main edition's text when it prints both; the text every edition shows when any edition in the
  // comparison does (the switch), even if the main one prints Esther once.
  const tradition = estherTradition(book, twoTexts ? undefined : one(search.tradition));
  const comparedTexts = tradition ? "none" : await comparedEstherTexts(book.bookNum, withSiglas);
  const asked: Tradition = one(search.tradition) === "HEBREW" ? "HEBREW" : "GREEK";
  // An edition whose index cannot be loaded is not known to print one text: the text asked for stays chosen.
  const shown: Tradition | undefined =
    tradition ?? (comparedTexts === "both" ? asked : comparedTexts === "unknown" && asked === "HEBREW" ? asked : undefined);
  // The view applies while comparing or reading Esther's two texts; elsewhere it is not carried on.
  const shownView = withSiglas.length > 0 || twoTexts ? view : "side-by-side";

  const info = await getAccess();
  /**
   * The chapter as the edition prints it, in one of Esther's texts or the book's only one. An edition may
   * print the previous chapter's last verse at the start of this one (NABRE John 7:53 opens John 8) and the
   * next chapter's first verse at the end of this one (NABRE Wis 12:1 closes Wis 11).
   */
  const printed = async (text?: Tradition, chapterMissing: "404" | "throw" = "404"): Promise<{ rows: VerseRow[]; truncated: boolean }> => {
    const request = { sigla: edition.sigla, bookAbbrev: book.abbrev, access: info.access, ...(text && { tradition: text }) };
    const counts = text === "GREEK" && book.greekVersesPerChapter ? book.greekVersesPerChapter : book.versesPerChapter;
    const prevVerses = chapter > 1 ? counts[chapter - 2] : undefined;
    // The page's own text missing is a missing page; the Masoretic text beside it throws NotFound to its caller.
    const loading = getChapter({ ...request, chapter });
    const current: Chapter = chapterMissing === "404" ? await orNotFound(loading) : await loading;
    // A capped chapter stops at verse 30: the previous chapter's last verse would make it 31 and the next
    // chapter's would not follow it, so neither is fetched.
    const prevLast: VerseRow[] =
      prevVerses && !current.truncated
        ? await neighbourVerse(getVerses({ ...request, chapter: chapter - 1, verse: prevVerses }))
        : [];
    // The prologue is one block before chapter 1: no verse of it is printed elsewhere, nor one of chapter 1 in it.
    const nextFirst =
      chapter !== PROLOGUE && chapter < book.chapters && !current.truncated
        ? await neighbourVerse(getVerses({ ...request, chapter: chapter + 1, verse: 1 }))
        : [];
    return { rows: placeAsPrinted(prevLast, current.rows, nextFirst, chapter), truncated: current.truncated };
  };
  // Asked at the same time as the chapter; awaited where its icon is built.
  const outline = getOutline(edition.sigla, book.bookNum, info.access);
  // The Masoretic text beside the Septuagint, loaded at the same time; when it cannot be loaded, the
  // Septuagint alone with a note.
  const [main, masoretic] = await Promise.all([
    printed(twoTexts ? "GREEK" : tradition),
    twoTexts ? masoreticText(printed) : Promise.resolve(null),
  ]);
  // Signed-in readers' notes: each citation links into its own edition, keeping the comparison (not Esther's
  // text). From a compared edition's note, that edition leads and the others, this one included, are compared.
  const reader = info.access === "reader";
  const noteQuery = (target: string, own: string) => compareQuery({ with: comparisonFor(target, own, [edition.sigla, ...withSiglas]), view });
  // Each edition's index once, for the notes' links: the page's own editions, and any a note cites (CEI 2008's
  // notes cite the Nova Vulgata). One that cannot be loaded leaves its citations unlinked.
  const indexes = new Map<string, Promise<EditionIndex | null>>([[edition.sigla, Promise.resolve(index)]]);
  const indexOf = (sigla: string) => {
    if (!indexes.has(sigla)) indexes.set(sigla, getIndex(sigla).catch(() => null));
    return indexes.get(sigla)!;
  };
  const linked = async (rs: VerseRow[], sigla: string): Promise<VerseRow[]> => {
    if (!reader) return rs;
    const found = new Map(await Promise.all([sigla, ...editionsCited(rs, sigla)].map(async (s) => [s, await indexOf(s)] as const)));
    return withNoteLinks(rs, sigla, (s) => {
      const idx = found.get(s);
      if (!idx) return undefined;
      const name = s === sigla ? undefined : (editions.find((e) => e.sigla === s)?.fullname ?? s);
      return { index: idx, base: `/${locale}/read/${editionSlug(s)}`, query: noteQuery(s, sigla), ...(name && { name }) };
    });
  };
  const rows = await linked(main.rows, edition.sigla);
  const masoreticRows = masoretic && masoretic !== "unavailable" ? await linked(masoretic.rows, edition.sigla) : [];
  const compared = withSiglas.map((sigla) => editions.find((e) => e.sigla === sigla)!);
  // The compared editions read with the main one's access; one that cannot be reached degrades to a note
  // (it does not show the error page).
  const seconds = await Promise.all(
    compared.map(async (e) => {
      const second = await loadSecond({
        mainSigla: edition.sigla, mainBookAbbrev: book.abbrev, mainIndex: index, bookNum: book.bookNum, chapter,
        mainRows: rows, withSigla: e.sigla, access: info.access, tradition: shown,
      });
      if (!reader || (second.mode !== "aligned" && second.mode !== "whole-chapter") || !second.rows.some((r) => r.notes)) return second;
      return { ...second, rows: await linked(second.rows, e.sigla) };
    }),
  );
  // The footnotes under the chapter (a panel on phones), each edition's apart.
  const noteGroups: NoteGroup[] = reader
    ? [
        { edition: edition.sigla, name: edition.fullname, notes: chapterFootnotes([...rows, ...masoreticRows]) },
        ...compared.map((e, i) => {
          const s = seconds[i];
          return { edition: e.sigla, name: e.fullname, notes: s.mode === "aligned" || s.mode === "whole-chapter" ? chapterFootnotes(s.rows) : [] };
        }),
      ]
    : [];
  // Visitors are told the notes exist where an edition on the page has them.
  const notesHint = !reader && [edition.sigla, ...withSiglas].some((s) => NOTE_EDITIONS.has(s));

  const qs = compareQuery({ with: withSiglas, view, tradition: shown, twoTexts });
  const base = `/read/${editionSlug(edition.sigla)}`;
  // Each text stops at its own cap; one notice tells it.
  const capped = main.truncated || (typeof masoretic === "object" && masoretic !== null && masoretic.truncated);
  const notice = noticeFor(capped, info, edition.copyright);
  const redirectTo = `/${locale}${base}/${slugFor(book, index.books)}/${chapter}${qs}`;
  // The main edition's titles in this book, opened from the title's line; links keep the comparison.
  const titleBase = `/${locale}${base}/${slugFor(book, index.books)}`;
  const tools = (
    <TitleIndex
      book={book.name}
      edition={edition.fullname}
      chapter={chapter}
      lang={edition.language || undefined}
      titles={(await outline).map((x) => ({
        level: x.level, title: x.title, chapter: x.chapter, verse: x.verse, segment: x.segment,
        href: `${titleBase}/${x.printedChapter ?? x.chapter}${qs}#${verseAnchor(x)}`,
      }))}
    />
  );
  const t = await getTranslations("Reader");
  const tn = await getTranslations("Notes");
  const heading = chapter === PROLOGUE ? t("prologueHeading", { book: book.name }) : t("heading", { book: book.name, chapter });
  // Columns need room (one per edition in the spread; the others go below); interlinear reads at a single
  // edition's width.
  const columns = twoTexts && masoretic !== "unavailable" ? 2 : 1 + seconds.filter((x) => x.mode === "aligned").length;
  const width = columns === 1 || view === "interlinear" ? "max-w-3xl" : columns === 2 ? "max-w-6xl" : "max-w-7xl";

  const nav = { index, bookNum: book.bookNum, chapter, base, query: qs, leavingQuery: compareQuery({ with: withSiglas, view }) };
  const turnTargets = chapterTargets(nav);

  return (
    <main className={`mx-auto w-full ${width} p-4 sm:p-6`}>
      <RememberChapter sigla={edition.sigla} bookNum={book.bookNum} chapter={chapter} />
      <ReaderBar
        locale={locale}
        edition={edition.sigla}
        editions={editions.map((e) => ({ sigla: e.sigla, fullname: e.fullname }))}
        books={index.books.map((b) => ({ slug: slugFor(b, index.books), name: b.name, chapters: b.chapters, bookNum: b.bookNum, prologue: b.prologue }))}
        book={slugFor(book, index.books)}
        bookNum={book.bookNum}
        chapter={chapter}
        withSiglas={withSiglas}
        view={shownView}
        esther={hasBothEstherTexts(book)}
        tradition={shown}
      />
      {/* Keyed by the chapter (and its query), so each chapter mounts a fresh, unturned page. */}
      <PageTurn key={`${base}/${slugFor(book, index.books)}/${chapter}${qs}`} {...turnTargets}>
        {shown && compared.length > 0 && await TraditionSwitch({
          tradition: shown,
          hrefFor: (t) => `${base}/${slugFor(book, index.books)}/${chapter}${compareQuery({ with: withSiglas, view, tradition: t })}`,
        })}
        {masoretic && masoretic !== "unavailable" ? (
          <article>
            <Spread
              title={heading}
              tools={tools}
              sides={[
                { sigla: edition.sigla, name: edition.fullname, lang: edition.language || undefined, rubric: { full: t("septuagint"), short: t("septuagintShort") } },
                { sigla: `${edition.sigla}-MT`, name: edition.fullname, lang: edition.language || undefined, rubric: { full: t("masoretic"), short: t("masoreticShort") } },
              ]}
              rows={buildRows(rows, [masoreticRows], book.bookNum)}
              chapter={chapter}
              truncated={[main.truncated, masoretic.truncated]}
              view={view}
              gapNotes={false}
            />
          </article>
        ) : masoretic === "unavailable" ? (
          <>
            <BookPage heading={heading} chapter={chapter} rows={rows} lang={edition.language || undefined} tools={tools} />
            <p role="note" className="my-4 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
              {t("secondUnavailable", { second: t("masoretic") })}
            </p>
          </>
        ) : compared.length > 0 ? (
          await Interlinear({
            heading,
            tools,
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
          <BookPage heading={heading} chapter={chapter} rows={rows} lang={edition.language || undefined} tools={tools} />
        )}
        {notice && await CappedNotice({ kind: notice, redirectTo, ...(compared.length > 0 && { edition: edition.fullname }) })}
        {notesHint && (
          <p className="mt-6 text-center font-sans text-sm text-slate-500 dark:text-slate-400">{tn("visitorHint")}</p>
        )}
        {await ChapterNav(nav)}
      </PageTurn>
      {/* Outside the page turn, whose clip would cut the fixed panel on phones. */}
      <ChapterNotes groups={noteGroups} />
    </main>
  );
}
