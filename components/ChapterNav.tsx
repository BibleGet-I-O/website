import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { slugFor } from "@/lib/api";
import type { EditionIndex } from "@/lib/types";

export type ChapterRef = { slug: string; chapter: number };

/** The previous and next chapters in the edition's book order, crossing books (Matthew 28 → Mark 1). */
export function neighbours(index: EditionIndex, bookNum: number, chapter: number): { prev?: ChapterRef; next?: ChapterRef } {
  const i = index.books.findIndex((b) => b.bookNum === bookNum);
  if (i < 0) return {};
  const book = index.books[i];
  const out: { prev?: ChapterRef; next?: ChapterRef } = {};
  if (chapter > 1) out.prev = { slug: slugFor(book), chapter: chapter - 1 };
  else if (i > 0) out.prev = { slug: slugFor(index.books[i - 1]), chapter: index.books[i - 1].chapters };
  if (chapter < book.chapters) out.next = { slug: slugFor(book), chapter: chapter + 1 };
  else if (i < index.books.length - 1) out.next = { slug: slugFor(index.books[i + 1]), chapter: 1 };
  return out;
}

const linkClass = "rounded border border-slate-200 px-3 py-1 hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600";

/** Previous / next chapter links; `base` is the edition's locale-less path, `query` the kept query string. */
export async function ChapterNav({ index, bookNum, chapter, base, query = "" }: { index: EditionIndex; bookNum: number; chapter: number; base: string; query?: string }) {
  const t = await getTranslations("Reader");
  const { prev, next } = neighbours(index, bookNum, chapter);
  const href = (r: ChapterRef) => `${base}/${r.slug}/${r.chapter}${query}`;
  return (
    <nav aria-label={t("chapterNav")} className="mt-8 flex justify-between text-sm">
      {prev ? (
        <Link href={href(prev)} rel="prev" className={linkClass}>
          ← {t("previous")}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={href(next)} rel="next" className={linkClass}>
          {t("next")} →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
