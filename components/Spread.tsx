import { Fragment, type ReactNode } from "react";
import { GapNote } from "@/components/GapNote";
import { Headings, VerseLine, headingsBefore } from "@/components/VerseLines";
import type { View } from "@/lib/compare";
import type { ParallelRow } from "@/lib/parallel";

export type SpreadSide = { sigla: string; name: string; lang?: string };

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
 * Section headings get a row of their own above their verse, so that one edition's headings never push its
 * verse below its counterparts (CEI2008 Gn 1:1 under two headings stays level with the Nova Vulgata's 1:1).
 *
 * A row an edition has no verse in gets the "absent" note on that side, except where the emptiness is not
 * the edition's: the rest of an edition after its own cap (`truncated`, by side), and, for a compared
 * edition, a verse of another chapter the main edition prints on this page (the compared edition prints it
 * in its own chapter).
 */
export function Spread({ sides, rows, chapter, truncated = [], view = "side-by-side" }: {
  sides: SpreadSide[]; rows: ParallelRow[]; chapter: number; truncated?: boolean[]; view?: View;
}) {
  const interlinear = view === "interlinear";
  const cellsOf = (r: ParallelRow) => [r.a, ...r.others];
  const last = sides.map((_, s) => rows.reduce((at, r, i) => (cellsOf(r)[s] ? i : at), -1));
  const cell = (r: ParallelRow, i: number, s: number): ReactNode => {
    const v = cellsOf(r)[s];
    // Numbered against the main chapter: VGCL 9:22 beside NABRE Psalm 10 reads "9:22".
    if (v) return <VerseLine row={v} chapter={chapter} headings={false} />;
    if (truncated[s] && i > last[s]) return null;
    if (s > 0 && r.a && r.a.chapter !== chapter) return null;
    return <GapNote edition={sides[s].name} />;
  };
  const cols = interlinear ? 1 : sides.length;
  // Three columns on a phone: a smaller text so the words fit.
  const size = cols === 3 ? "text-base sm:text-lg" : "text-lg";
  const gap = cols === 3 ? "gap-x-3 sm:gap-x-6" : "gap-x-4 sm:gap-x-8";
  const muted = (s: number) => (s > 0 ? "text-slate-700 dark:text-slate-300" : "");

  return (
    <div data-testid="spread" className={`grid ${COLUMNS[cols]} ${gap} font-serif ${size} leading-relaxed`}>
      {!interlinear && sides.map((side) => (
        <p key={side.sigla} data-testid="column-name" className="mb-2 text-center font-sans text-sm font-semibold text-slate-600 dark:text-slate-400">
          {side.name}
        </p>
      ))}
      {rows.map((r, i) => {
        const titles = cellsOf(r).map((v) => headingsBefore(v));
        return (
          <Fragment key={i}>
            {titles.some((h) => h.length > 0) && sides.map((side, s) => (
              <div key={`h${s}`} data-testid={`heading-${LETTERS[s]}`} lang={side.lang} className={muted(s)}>
                <Headings titles={titles[s]} />
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
                  {interlinear && s > 0 && content && (
                    <span data-testid="sigla" className="ml-10 font-sans text-xs text-slate-500 dark:text-slate-400">{side.sigla}</span>
                  )}
                  {content}
                </div>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}
