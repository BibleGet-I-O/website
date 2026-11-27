import { Fragment, type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { BookPage } from "@/components/BookPage";
import { CappedNotice, type NoticeKind } from "@/components/CappedNotice";
import { Spread, type SpreadSide } from "@/components/Spread";
import { StickyHead } from "@/components/StickyHead";
import { VerseLines } from "@/components/VerseLines";
import type { View } from "@/lib/compare";
import type { Second } from "@/lib/interlinear";
import { buildRows, PSALMS } from "@/lib/parallel";
import type { VerseRow } from "@/lib/types";

const noteClass = "my-4 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900";

/** A compared edition: who it is, how it loaded, and why it stops early (see noticeFor), if it does. */
export type Compared = { side: SpreadSide; second: Second; notice?: NoticeKind | null };

export type InterlinearProps = {
  heading: string;
  /** Beside the heading (the title index). */
  tools?: ReactNode;
  main: SpreadSide;
  /** One or two compared editions, in the order of `?with=`. */
  others: Compared[];
  /** The main edition's rows as printed on this page. */
  rows: VerseRow[];
  bookNum: number;
  bookName: string;
  chapter: number;
  /** The main edition is capped (its own notice follows the page). */
  truncated: boolean;
  view: View;
  redirectTo: string;
};

/**
 * The main edition beside the compared ones. The compared editions that divide this chapter as the main one
 * does stand in the spread, side by side or interlinear; each of the others follows it: shown whole when it
 * divides the book's chapters differently, or a note when it lacks the book or chapter or could not be
 * loaded. When none can be loaded, the book view with the notes.
 */
export async function Interlinear(p: InterlinearProps) {
  const t = await getTranslations("Reader");
  const reviewLabel = t("mentions.reviewLabel");
  const { chapter } = p;
  const names = (o: Compared) => ({ main: p.main.name, second: o.side.name, book: p.bookName, chapter });
  const note = (key: string, text: string) => <p key={key} role="note" className={noteClass}>{text}</p>;
  const capped = async (o: Compared) =>
    o.notice ? await CappedNotice({ kind: o.notice, redirectTo: p.redirectTo, edition: o.side.name }) : null;

  if (p.others.every((o) => o.second.mode === "unavailable")) {
    return (
      <>
        <BookPage heading={p.heading} chapter={chapter} rows={p.rows} lang={p.main.lang} tools={p.tools} reviewLabel={reviewLabel} />
        {p.others.map((o) => note(o.side.sigla, t("secondUnavailable", names(o))))}
      </>
    );
  }

  const aligned = p.others.filter((o) => o.second.mode === "aligned");
  const rowsOf = (o: Compared) => (o.second.mode === "aligned" ? o.second.rows : []);
  const truncatedOf = (o: Compared) => (o.second.mode === "aligned" ? o.second.truncated : false);

  const below: ReactNode[] = [];
  for (const o of p.others) {
    const s = o.second;
    const k = o.side.sigla;
    if (s.mode === "aligned") continue;
    if (s.mode === "unavailable") below.push(note(k, t("secondUnavailable", names(o))));
    else if (s.mode === "missing") {
      const key = { book: "secondNoBook", chapter: "secondMissing", prologue: "secondNoPrologue", "esther-additions": "estherAdditions" } as const;
      below.push(note(k, t(key[s.reason], names(o))));
    } else if (s.rows.length === 0) below.push(note(k, t("dividedNoChapter", names(o))));
    else {
      below.push(
        <section key={k}>
          {note(`${k}-note`, t("dividedDifferently", names(o)))}
          <h2 className="mt-6 mb-1 text-center text-2xl font-semibold">{t("heading", { book: s.book.name, chapter })}</h2>
          <p className="mb-4 text-center font-sans text-sm text-slate-600 dark:text-slate-400">{o.side.name}</p>
          <VerseLines rows={s.rows} chapter={chapter} lang={o.side.lang} reviewLabel={reviewLabel} />
          {await capped(o)}
        </section>,
      );
    }
  }

  return (
    <article>
      {aligned.length > 0 ? (
        <>
          <Spread
            title={p.heading}
            tools={p.tools}
            sides={[p.main, ...aligned.map((o) => o.side)]}
            rows={buildRows(p.rows, aligned.map(rowsOf), p.bookNum)}
            chapter={chapter}
            truncated={[p.truncated, ...aligned.map(truncatedOf)]}
            view={p.view}
            psalms={p.bookNum === PSALMS}
            reviewLabel={reviewLabel}
          />
          {(await Promise.all(aligned.map(capped))).map((n, i) => <Fragment key={aligned[i].side.sigla}>{n}</Fragment>)}
        </>
      ) : (
        <>
          <StickyHead title={p.heading} columns={[]} gridClass="" running={1} tools={p.tools} />
          <VerseLines rows={p.rows} chapter={chapter} lang={p.main.lang} headCol={0} reviewLabel={reviewLabel} />
        </>
      )}
      {below}
    </article>
  );
}
