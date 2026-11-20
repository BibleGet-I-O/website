import { getTranslations } from "next-intl/server";
import { TurnLink } from "@/components/PageTurn";
import { slugFor } from "@/lib/api";
import type { EditionIndex } from "@/lib/types";

export type ChapterRef = { slug: string; chapter: number };

/** The previous and next chapters in the edition's book order, crossing books (Matthew 28 → Mark 1). */
export function neighbours(index: EditionIndex, bookNum: number, chapter: number): { prev?: ChapterRef; next?: ChapterRef } {
  const i = index.books.findIndex((b) => b.bookNum === bookNum);
  if (i < 0) return {};
  const book = index.books[i];
  const out: { prev?: ChapterRef; next?: ChapterRef } = {};
  if (chapter > 1) out.prev = { slug: slugFor(book, index.books), chapter: chapter - 1 };
  else if (i > 0) out.prev = { slug: slugFor(index.books[i - 1], index.books), chapter: index.books[i - 1].chapters };
  if (chapter < book.chapters) out.next = { slug: slugFor(book, index.books), chapter: chapter + 1 };
  else if (i < index.books.length - 1) out.next = { slug: slugFor(index.books[i + 1], index.books), chapter: 1 };
  return out;
}

const linkClass = "rounded border border-slate-200 px-3 py-1 hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600";

type NavProps = { index: EditionIndex; bookNum: number; chapter: number; base: string; query?: string; leavingQuery?: string };

/**
 * The previous and next chapters' hrefs (locale-less): `base` is the edition's path, `query` the kept query string,
 * and `leavingQuery` (when given) the one for a link into another book: what belongs to this book (Esther's texts)
 * stays behind. The chapter links and the page turn both go there.
 */
export function chapterTargets({ index, bookNum, chapter, base, query = "", leavingQuery }: NavProps): { prev?: string; next?: string } {
  const { prev, next } = neighbours(index, bookNum, chapter);
  const here = index.books.find((b) => b.bookNum === bookNum);
  const sameBook = (r: ChapterRef) => here !== undefined && r.slug === slugFor(here, index.books);
  const href = (r: ChapterRef) => `${base}/${r.slug}/${r.chapter}${sameBook(r) ? query : (leavingQuery ?? query)}`;
  return { ...(prev && { prev: href(prev) }), ...(next && { next: href(next) }) };
}

/** Previous / next chapter links; inside a PageTurn a plain click plays the turn. */
export async function ChapterNav(props: NavProps) {
  const t = await getTranslations("Reader");
  const { prev, next } = chapterTargets(props);
  return (
    <nav aria-label={t("chapterNav")} className="mt-8 flex justify-between text-sm">
      {prev ? (
        <TurnLink side="prev" href={prev} rel="prev" className={linkClass}>
          ← {t("previous")}
        </TurnLink>
      ) : (
        <span />
      )}
      {next ? (
        <TurnLink side="next" href={next} rel="next" className={linkClass}>
          {t("next")} →
        </TurnLink>
      ) : (
        <span />
      )}
    </nav>
  );
}
