"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ReaderSettings, type SettingsChange } from "@/components/ReaderSettings";
import { compareQuery, type View } from "@/lib/compare";
import { editionSlug } from "@/lib/slug";
import type { Tradition } from "@/lib/esther";

export type ReaderBarProps = {
  locale: string;
  edition: string;
  editions: { sigla: string; fullname: string }[];
  books: { slug: string; name: string; chapters: number }[];
  book: string;
  /** The book's number, the same in every edition (its slug is not): another edition opens on it. */
  bookNum: number;
  chapter: number;
  /** The compared editions (`?with=`), in order; empty when reading one edition. */
  withSiglas: string[];
  view: View;
  /** Whether the edition has both Esther texts and this is Esther: then the Greek / Hebrew choice shows. */
  esther: boolean;
  tradition?: Tradition;
};

const selectClass = "rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900";

/** The reader's top bar: edition, book and chapter, and the ⚙ menu (comparison, its layout, Esther's text). */
export function ReaderBar(p: ReaderBarProps) {
  const t = useTranslations("Reader");
  const router = useRouter();
  const current = p.books.find((b) => b.slug === p.book);

  const go = (o: SettingsChange & { book?: string; chapter?: number }) => {
    const book = o.book ?? p.book;
    const chapter = o.chapter ?? p.chapter;
    // The tradition belongs to Esther: kept only while the book stays the same; Greek is the default.
    const tradition = o.tradition ?? (book === p.book ? p.tradition : undefined);
    const qs = compareQuery({ with: o.with ?? p.withSiglas, view: o.view ?? p.view, tradition: p.esther ? tradition : undefined });
    router.push(`/${p.locale}/read/${editionSlug(p.edition)}/${book}/${chapter}${qs}`);
  };

  // The edition's books page opens this chapter when the edition has it, and lists the books when it does not.
  const switchEdition = (sigla: string) => {
    const rest = compareQuery({
      with: p.withSiglas.filter((s) => s !== sigla),
      view: p.view,
      tradition: p.esther ? p.tradition : undefined,
    });
    router.push(`/${p.locale}/read/${editionSlug(sigla)}?book=${p.bookNum}&chapter=${p.chapter}${rest.replace("?", "&")}`);
  };

  return (
    <div role="toolbar" aria-label={t("toolbar")} className="mb-6 flex flex-wrap items-center gap-2 text-sm">
      <label className="sr-only" htmlFor="rb-edition">{t("edition")}</label>
      <select
        id="rb-edition"
        className={`${selectClass} min-w-0 max-w-full`}
        value={p.edition}
        onChange={(e) => switchEdition(e.target.value)}
      >
        {p.editions.map((e) => (
          <option key={e.sigla} value={e.sigla}>{e.fullname}</option>
        ))}
      </select>

      <label className="sr-only" htmlFor="rb-book">{t("book")}</label>
      <select id="rb-book" className={selectClass} value={p.book} onChange={(e) => go({ book: e.target.value, chapter: 1 })}>
        {p.books.map((b) => (
          <option key={b.slug} value={b.slug}>{b.name}</option>
        ))}
      </select>

      <label className="sr-only" htmlFor="rb-chapter">{t("chapter")}</label>
      <select id="rb-chapter" className={selectClass} value={p.chapter} onChange={(e) => go({ chapter: Number(e.target.value) })}>
        {Array.from({ length: current?.chapters ?? p.chapter }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>

      <span className="ml-auto">
        <ReaderSettings
          editions={p.editions}
          main={p.edition}
          withSiglas={p.withSiglas}
          view={p.view}
          esther={p.esther}
          tradition={p.tradition}
          onChange={go}
        />
      </span>
    </div>
  );
}
