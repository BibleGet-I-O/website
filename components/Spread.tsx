import { Fragment, type ReactNode } from "react";
import { GapNote } from "@/components/GapNote";
import { Headings, VerseLine, headingsBefore } from "@/components/VerseLines";
import { StickyHead, type HeadColumn } from "@/components/StickyHead";
import type { View } from "@/lib/compare";
import type { ParallelRow } from "@/lib/parallel";

/**
 * A column: an edition, or one of its texts (Esther's Septuagint and Masoretic text), which is headed by a red
 * rubric, its full name from `sm` up and its short one (LXX, MT) on phones, and tagged with the short one when
 * interlinear.
 */
export type SpreadSide = { sigla: string; name: string; lang?: string; rubric?: { full: string; short: string } };

/** Cell test ids by side: the main edition is `a`, the compared ones `b` and `c`. */
const LETTERS = "abc";
/** Static class names, so Tailwind sees them. */
const COLUMNS: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" };

/**
 * The main edition (`sides[0]`) and up to two compared ones, one verse per line, each row level with its
 * counterparts. Side by side (the default) is a column per edition at every width, each headed by its
 * edition's name; interlinear is one column, each compared verse under the main one, tagged with its
 * edition's sigla.
 *
 * Side by side, section headings get a row of their own above their verse, so that one edition's headings
 * never push its verse below its counterparts (CEI2008 Gn 1:1 under two headings stays level with the Nova
 * Vulgata's 1:1). Interlinear, each edition's headings sit in its own cell, under its tag, above its verse.
 *
 * A row an edition has no verse in gets the "absent" note on that side, except where the emptiness is not
 * the edition's: the rest of an edition after its own cap (`truncated`, by side), and, for a compared
 * edition, a verse of another chapter the main edition prints on this page (the compared edition prints it
 * in its own chapter). Without `gapNotes` (Esther's two texts, where the Septuagint's additions simply have no
 * Masoretic counterpart) the empty side stays empty.
 */
export function Spread({ sides, rows, chapter, truncated = [], view = "side-by-side", gapNotes = true, title }: {
  sides: SpreadSide[]; rows: ParallelRow[]; chapter: number; truncated?: boolean[]; view?: View; gapNotes?: boolean;
  /** The chapter's title: given, it heads the page in a strip that stays at the top, with the editions' names. */
  title?: string;
}) {
  const interlinear = view === "interlinear";
  const cols = interlinear ? 1 : sides.length;
  const cellsOf = (r: ParallelRow) => [r.a, ...r.others];
  const last = sides.map((_, s) => rows.reduce((at, r, i) => (cellsOf(r)[s] ? i : at), -1));
  const cell = (r: ParallelRow, i: number, s: number): ReactNode => {
    const v = cellsOf(r)[s];
    // Numbered against the main chapter: VGCL 9:22 beside NABRE Psalm 10 reads "9:22".
    // A row's verse can be linked to (a search result: Esther's two texts are a Spread): on the first cell that
    // prints it, the main side's when it does, so one id per verse.
    // A mid-verse heading feeds its column's running head (only the main edition's, interlinear).
    const headCol = interlinear ? (s === 0 ? 0 : undefined) : s;
    if (v) return <VerseLine row={v} chapter={chapter} headings={false} anchor={s === cellsOf(r).findIndex(Boolean)} headCol={headCol} />;
    if (truncated[s] && i > last[s]) return null;
    if (s > 0 && r.a && r.a.chapter !== chapter) return null;
    return gapNotes ? <GapNote edition={sides[s].name} /> : null;
  };
  // Three columns on a phone: a smaller text so the words fit.
  const size = cols === 3 ? "text-base sm:text-lg" : "text-lg";
  const gap = cols === 3 ? "gap-x-3 sm:gap-x-6" : "gap-x-4 sm:gap-x-8";
  // A compared edition reads a shade quieter than the main one; two texts of one edition are equals.
  const muted = (s: number) => (s > 0 && !sides[s].rubric ? "text-slate-700 dark:text-slate-300" : "");

  const grid = `grid ${COLUMNS[cols]} ${gap}`;
  // The editions' names: the rubric's (Septuagint / Masoretic text), short on phones, or the edition's.
  const heads: HeadColumn[] = interlinear ? [] : sides.map((side) => side.rubric ? {
    key: side.sigla,
    className: "text-center font-sans text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-400",
    label: (
      <>
        {/* On phones the short name shows; screen readers always read the full one. */}
        <span className="sr-only sm:not-sr-only">{side.rubric.full}</span>
        <span aria-hidden="true" className="sm:hidden">{side.rubric.short}</span>
      </>
    ),
  } : { key: side.sigla, label: side.name });

  return (
    <>
    {title !== undefined && <StickyHead title={title} columns={heads} gridClass={grid} running={interlinear ? 1 : sides.length} />}
    <div data-testid="spread" className={`${grid} font-serif ${size} leading-relaxed`}>
      {title === undefined && heads.map((h) => (
        <p key={h.key} data-testid="column-name" className={`mb-2 ${h.className ?? "text-center font-sans text-sm font-semibold text-slate-600 dark:text-slate-400"}`}>
          {h.label}
        </p>
      ))}
      {rows.map((r, i) => {
        const titles = cellsOf(r).map((v) => headingsBefore(v));
        return (
          <Fragment key={i}>
            {/* Side by side: a row of their own. Interlinear: each edition's in its own cell, under its tag. */}
            {!interlinear && titles.some((h) => h.length > 0) && sides.map((side, s) => (
              <div key={`h${s}`} data-testid={`heading-${LETTERS[s]}`} lang={side.lang} className={muted(s)}>
                <Headings titles={titles[s]} col={s} row={cellsOf(r)[s]} />
              </div>
            ))}
            {sides.map((side, s) => {
              const content = cell(r, i, s);
              const last = s === sides.length - 1;
              return (
                <div
                  key={s}
                  data-testid={`cell-${LETTERS[s]}`}
                  lang={side.lang}
                  className={`py-0.5 ${muted(s)} ${interlinear && last ? "mb-3" : ""}`}
                >
                  {interlinear && (s > 0 || side.rubric) && (content || titles[s].length > 0) && (
                    <span data-testid="sigla" title={side.rubric?.full} className="font-sans text-xs text-slate-500 dark:text-slate-400">{side.rubric?.short ?? side.sigla}</span>
                  )}
                  {/* Interlinear: one column, so only the main edition's headings feed the running head. */}
                  {interlinear && <Headings titles={titles[s]} col={s === 0 ? 0 : undefined} row={cellsOf(r)[s]} />}
                  {content}
                </div>
              );
            })}
          </Fragment>
        );
      })}
    </div>
    </>
  );
}
