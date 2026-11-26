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
