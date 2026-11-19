"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { editionSlug } from "@/components/EditionCard";
import type { Tradition } from "@/lib/esther";

export type ReaderBarProps = {
  locale: string;
  edition: string;
  editions: { sigla: string; fullname: string }[];
  books: { slug: string; name: string; chapters: number }[];
  book: string;
  chapter: number;
  /** The interlinear edition (`?with=`), when the toggle is on. */
  withSigla?: string;
  /** Whether the edition has both Esther texts and this is Esther: then the Greek / Hebrew choice shows. */
  esther: boolean;
  tradition?: Tradition;
};

const selectClass = "rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900";

/** The reader's top bar: edition, book and chapter, the interlinear toggle and edition, and Esther's text. */
export function ReaderBar(p: ReaderBarProps) {
  const t = useTranslations("Reader");
  const router = useRouter();
  const others = p.editions.filter((e) => e.sigla !== p.edition);
  const current = p.books.find((b) => b.slug === p.book);

  const go = (o: { book?: string; chapter?: number; with?: string | null; tradition?: Tradition }) => {
    const book = o.book ?? p.book;
    const chapter = o.chapter ?? p.chapter;
    const qs = new URLSearchParams();
    const w = o.with === undefined ? p.withSigla : o.with;
    if (w) qs.set("with", w);
    // The tradition belongs to Esther: kept only while the book stays the same; Greek is the default.
    const tradition = o.tradition ?? (book === p.book ? p.tradition : undefined);
    if (p.esther && tradition === "HEBREW") qs.set("tradition", tradition);
    const q = qs.toString();
    router.push(`/${p.locale}/read/${editionSlug(p.edition)}/${book}/${chapter}${q ? `?${q}` : ""}`);
  };

  return (
    <div role="toolbar" aria-label={t("toolbar")} className="mb-6 flex flex-wrap items-center gap-2 text-sm">
      <label className="sr-only" htmlFor="rb-edition">{t("edition")}</label>
      <select
        id="rb-edition"
        className={selectClass}
        value={p.edition}
        // Book names differ between editions, so another edition opens on its books page.
        onChange={(e) => router.push(`/${p.locale}/read/${editionSlug(e.target.value)}`)}
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

      {p.esther && (
        <>
          <label className="sr-only" htmlFor="rb-tradition">{t("estherText")}</label>
          <select
            id="rb-tradition"
            className={selectClass}
            value={p.tradition ?? "GREEK"}
            onChange={(e) => go({ tradition: e.target.value === "HEBREW" ? "HEBREW" : "GREEK" })}
          >
            <option value="GREEK">{t("greek")}</option>
            <option value="HEBREW">{t("hebrew")}</option>
          </select>
        </>
      )}

      <span className="ml-auto flex items-center gap-2">
        <input
          id="rb-interlinear"
          type="checkbox"
          checked={Boolean(p.withSigla)}
          disabled={others.length === 0}
          onChange={(e) => go({ with: e.target.checked ? others[0]?.sigla ?? null : null })}
        />
        <label htmlFor="rb-interlinear">{t("interlinear")}</label>
        <label className="sr-only" htmlFor="rb-with">{t("secondEdition")}</label>
        <select
          id="rb-with"
          className={selectClass}
          value={p.withSigla ?? ""}
          disabled={!p.withSigla}
          onChange={(e) => go({ with: e.target.value || null })}
        >
          {!p.withSigla && <option value="">—</option>}
          {others.map((e) => (
            <option key={e.sigla} value={e.sigla}>{e.fullname}</option>
          ))}
        </select>
      </span>
    </div>
  );
}
