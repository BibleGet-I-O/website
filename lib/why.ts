import type { VerseRow } from "@/lib/types";

/** A verse the edition prints in this chapter though it belongs to another: NABRE Wis 12:1 closing Wis 11, John 7:53 opening John 8. */
export function printedElsewhere(row: VerseRow, chapter: number): boolean {
  return row.printedChapter === chapter && row.chapter !== chapter;
}

/** A row's Hebrew position, [psalm, verse], from its `psalmHebrew` ("23:1"); null when not reported. */
function hebrew(r: VerseRow): [number, number] | null {
  const m = /^(\d+):(\d+)/.exec(r.psalmHebrew ?? "");
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/**
 * A psalm's place in the other (Hebrew) numbering, for beside its title; null where the two agree or the rows report none.
 * VGCL 22 → "(23)"; VGCL 9, which is Hebrew 9 and 10 → "(9–10)"; VGCL 147, which is Hebrew 147:12-20 → "(147:12–20)".
 */
export function psalmNote(rows: VerseRow[], chapter: number): string | null {
  const pairs = rows.flatMap((r) => { const h = hebrew(r); return h ? [{ r, h }] : []; });
  if (pairs.length === 0) return null;
  const psalms = [...new Set(pairs.map((p) => p.h[0]))];
  const sameVerses = pairs.every((p) => p.h[1] === p.r.verse);
  if (psalms.length > 1) return `(${psalms[0]}–${psalms.at(-1)})`;
  if (sameVerses) return psalms[0] === chapter ? null : `(${psalms[0]})`;
  return `(${psalms[0]}:${pairs[0].h[1]}–${pairs.at(-1)!.h[1]})`;
}

/**
 * The rows of this chapter the API marks omitted, grouped into runs of consecutive numbers ("(10. 11)", Sir 9),
 * keyed by the index of each run's first row: that row prints the run's rubric, the others only their anchors.
 */
export function omittedRuns(rows: VerseRow[], chapter: number): Map<number, [number, number]> {
  const runs = new Map<number, [number, number]>();
  let first = -1;
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    const continues = first >= 0 && prev?.omitted && prev.chapter === chapter && r.verse === prev.verse + 1;
    if (!r.omitted || r.chapter !== chapter) first = -1;
    else if (continues) runs.set(first, [runs.get(first)![0], r.verse]);
    else {
      first = i;
      runs.set(i, [r.verse, r.verse]);
    }
  });
  return runs;
}

/**
 * The numbers an edition skips inside a chapter, keyed by the index of the row after which each run falls: the
 * verses its critical text omits, which the Nova Vulgata prints as a bracketed number ("(7)", Acts 24; "(10. 11)",
 * Sir 9). Only this chapter's rows count, so a chapter that starts later or ends sooner has none; a run is left out
 * when any of its numbers is printed elsewhere in the chapter (transposed verses).
 */
export function omittedAfter(rows: VerseRow[], chapter: number): Map<number, [number, number]> {
  const own = rows.flatMap((r, i) => (r.chapter === chapter ? [{ r, i }] : []));
  const present = new Set(own.map((o) => o.r.verse));
  const gaps = new Map<number, [number, number]>();
  for (let k = 1; k < own.length; k++) {
    const from = own[k - 1].r.verse + 1;
    const to = own[k].r.verse - 1;
    if (to < from) continue;
    let printed = false;
    for (let v = from; v <= to && !printed; v++) printed = present.has(v);
    if (!printed) gaps.set(own[k - 1].i, [from, to]);
  }
  return gaps;
}
