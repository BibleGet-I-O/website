import { Fragment, type ReactNode } from "react";
import { GapNote } from "@/components/GapNote";
import { VerseLine } from "@/components/VerseLines";
import type { ParallelRow } from "@/lib/parallel";

export type SpreadSide = { sigla: string; name: string; lang?: string };

/**
 * Two editions as facing pages, one verse per line, each row level with its counterpart. Side by side from
 * the md breakpoint and in landscape; in portrait below md the grid has one column, so each verse of the
 * second edition sits under its counterpart (tagged with the edition's sigla).
 *
 * A one-sided row gets the "absent" note on its empty side, except where the emptiness is not the
 * edition's: the rest of either edition after the other's cap (`aTruncated`, `bTruncated`), and a verse of
 * another chapter the main edition prints on this page (the second prints it in its own chapter).
 */
export function Spread({ a, b, rows, chapter, aTruncated = false, bTruncated = false }: {
  a: SpreadSide; b: SpreadSide; rows: ParallelRow[]; chapter: number; aTruncated?: boolean; bTruncated?: boolean;
}) {
  let lastA = -1;
  let lastB = -1;
  rows.forEach((r, i) => {
    if (r.a) lastA = i;
    if (r.b) lastB = i;
  });
  const cellA = (r: ParallelRow, i: number): ReactNode => {
    if (r.a) return <VerseLine row={r.a} chapter={chapter} />;
    return aTruncated && i > lastA ? null : <GapNote edition={a.name} />;
  };
  const cellB = (r: ParallelRow, i: number): ReactNode => {
    // Numbered against the main chapter: VGCL 9:22 beside NABRE Psalm 10 reads "9:22".
    if (r.b) return <VerseLine row={r.b} chapter={chapter} />;
    if (bTruncated && i > lastB) return null;
    return r.a && r.a.chapter !== chapter ? null : <GapNote edition={b.name} />;
  };
  return (
    <div data-testid="spread" className="grid grid-cols-1 gap-x-8 font-serif text-lg leading-relaxed md:grid-cols-2 landscape:grid-cols-2">
      <p className="mb-2 hidden text-center font-sans text-sm font-semibold text-slate-600 md:block landscape:block dark:text-slate-400">{a.name}</p>
      <p className="mb-2 hidden text-center font-sans text-sm font-semibold text-slate-600 md:block landscape:block dark:text-slate-400">{b.name}</p>
      {rows.map((r, i) => {
        const b2 = cellB(r, i);
        return (
        <Fragment key={i}>
          <div data-testid="cell-a" lang={a.lang} className="py-0.5">
            {cellA(r, i)}
          </div>
          <div data-testid="cell-b" lang={b.lang} className="mb-2 py-0.5 text-slate-700 md:mb-0 landscape:mb-0 dark:text-slate-300">
            {b2 && <span className="ml-10 font-sans text-xs text-slate-500 md:hidden landscape:hidden dark:text-slate-400">{b.sigla}</span>}
            {b2}
          </div>
        </Fragment>
        );
      })}
    </div>
  );
}
