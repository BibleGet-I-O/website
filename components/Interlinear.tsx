import { getTranslations } from "next-intl/server";
import { BookPage } from "@/components/BookPage";
import { CappedNotice, type NoticeKind } from "@/components/CappedNotice";
import { Spread, type SpreadSide } from "@/components/Spread";
import { VerseLines } from "@/components/VerseLines";
import type { Second } from "@/lib/interlinear";
import { buildRows } from "@/lib/parallel";
import type { VerseRow } from "@/lib/types";

const noteClass = "my-4 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900";

export type InterlinearProps = {
  heading: string;
  main: SpreadSide;
  other: SpreadSide;
  /** The main edition's rows as printed on this page. */
  rows: VerseRow[];
  second: Second;
  bookNum: number;
  bookName: string;
  chapter: number;
  /** The main edition is capped (its own notice follows the page). */
  truncated: boolean;
  /** Why the second edition stops early, by who is reading (see noticeFor); null or absent when it does not. */
  secondNotice?: NoticeKind | null;
  redirectTo: string;
};

/**
 * Interlinear on: verse per line, the second edition beside the main one, or below it when the editions
 * divide the book's chapters differently. When the second edition cannot be loaded, the book view with a note.
 */
export async function Interlinear(p: InterlinearProps) {
  const t = await getTranslations("Reader");
  const { second, chapter } = p;
  const names = { main: p.main.name, second: p.other.name, book: p.bookName, chapter };
  const note = (text: string) => <p role="note" className={noteClass}>{text}</p>;

  if (second.mode === "unavailable") {
    return (
      <>
        <BookPage heading={p.heading} chapter={chapter} rows={p.rows} lang={p.main.lang} />
        {note(t("secondUnavailable", names))}
      </>
    );
  }
  const title = <h1 className="mb-6 text-center text-3xl font-semibold">{p.heading}</h1>;
  const capped = p.secondNotice ? await CappedNotice({ kind: p.secondNotice, redirectTo: p.redirectTo, edition: p.other.name }) : null;

  if (second.mode === "aligned") {
    return (
      <article>
        {title}
        <Spread
          a={p.main}
          b={p.other}
          rows={buildRows(p.rows, second.rows, p.bookNum)}
          chapter={chapter}
          aTruncated={p.truncated}
          bTruncated={second.truncated}
        />
        {capped}
      </article>
    );
  }

  let below;
  if (second.mode === "missing") {
    const key = { book: "secondNoBook", chapter: "secondMissing", "esther-additions": "estherAdditions" } as const;
    below = note(t(key[second.reason], names));
  } else if (second.rows.length === 0) {
    below = note(t("dividedNoChapter", names));
  } else {
    below = (
      <>
        {note(t("dividedDifferently", names))}
        <h2 className="mt-6 mb-1 text-center text-2xl font-semibold">{t("heading", { book: second.book.name, chapter })}</h2>
        <p className="mb-4 text-center font-sans text-sm text-slate-600 dark:text-slate-400">{p.other.name}</p>
        <VerseLines rows={second.rows} chapter={chapter} lang={p.other.lang} />
        {capped}
      </>
    );
  }
  return (
    <article>
      {title}
      <VerseLines rows={p.rows} chapter={chapter} lang={p.main.lang} />
      {below}
    </article>
  );
}
