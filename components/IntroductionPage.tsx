import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { IntroductionView } from "@/components/IntroductionView";
import { ReaderBar } from "@/components/ReaderBar";
import { getGeneralIntroduction, getIntroduction, NotFound, slugFor } from "@/lib/api";
import { withIntroLinks } from "@/lib/note-links";
import { editionSlug } from "@/lib/slug";
import type { View } from "@/lib/compare";
import type { Book, Edition, EditionIndex } from "@/lib/types";

/** The query a link from the introduction keeps (the comparison), with `part` set or not. */
function withPart(query: string, part?: string): string {
  const qs = new URLSearchParams(query.replace(/^\?/, ""));
  if (part) qs.set("part", part);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/**
 * `/read/{edition}/{book}/introduction`: the book's introduction as the edition prints it, and `?part=` one of the
 * general introductions that cover the book. For signed-in readers: a visitor is told so.
 */
export async function IntroductionPage({ locale, edition, editions, index, book, reader, part, withSiglas, view, query }: {
  locale: string;
  edition: Edition;
  editions: Edition[];
  index: EditionIndex;
  book: Book;
  reader: boolean;
  part?: string;
  withSiglas: string[];
  view: View;
  /** The comparison's query (`?with=…`), kept on every link. */
  query: string;
}) {
  const t = await getTranslations("Reader");
  const slug = slugFor(book, index.books);
  const bookBase = `/${locale}/read/${editionSlug(edition.sigla)}/${slug}`;
  const firstChapter = book.prologue ? 0 : 1;
  const bar = (
    <ReaderBar
      locale={locale}
      edition={edition.sigla}
      editions={editions.map((e) => ({ sigla: e.sigla, fullname: e.fullname }))}
      books={index.books.map((b) => ({ slug: slugFor(b, index.books), name: b.name, chapters: b.chapters, bookNum: b.bookNum, prologue: b.prologue }))}
      book={slug}
      bookNum={book.bookNum}
      chapter={firstChapter}
      part={part ? `introduction:${part}` : "introduction"}
      withSiglas={withSiglas}
      view={view}
      esther={false}
      indices={!edition.copyright || reader}
    />
  );
  const readBook = (
    <p className="mt-8 text-center font-sans">
      <a data-nav="" href={`${bookBase}/${firstChapter}${query}`} className="text-red-700 underline-offset-2 hover:underline dark:text-red-400">
        {t("readBook", { book: book.name })}
      </a>
    </p>
  );
  if (!reader) {
    return (
      <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
        {bar}
        <h1 className="mt-6 text-center font-sans text-xl font-semibold sm:text-2xl">{t("introductionTo", { book: book.name })}</h1>
        <p className="mt-6 text-center font-sans text-sm text-slate-500 dark:text-slate-400">{t("introductionsForReaders")}</p>
        {readBook}
      </main>
    );
  }
  let found;
  try {
    found = await getIntroduction(edition.sigla, book.bookNum);
  } catch (err) {
    if (err instanceof NotFound) notFound();
    throw err;
  }
  const { introduction: own, general } = found;
  // A general introduction is offered from the books it covers only.
  const shown = part ? (general.some((g) => g.id === part) ? await getGeneralIntroduction(edition.sigla, part) : null) : own;
  if (!shown) notFound();
  const links = { index, base: `/${locale}/read/${editionSlug(edition.sigla)}`, query };
  const others = [
    ...(part && own ? [{ title: t("introductionTo", { book: book.name }), href: `${bookBase}/introduction${query}` }] : []),
    ...general.filter((g) => g.id !== part).map((g) => ({ title: g.title, href: `${bookBase}/introduction${withPart(query, g.id)}` })),
  ];
  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      {bar}
      <div className="mt-4">
        <IntroductionView
          heading={part ? shown.title : t("introductionTo", { book: book.name })}
          intro={withIntroLinks(shown, links)}
          lang={edition.language || undefined}
          general={others}
        />
      </div>
      {readBook}
    </main>
  );
}
