import { psalmChapters } from "@/lib/parallel";
import type { VerseRow } from "@/lib/types";

/** A verse the edition prints in this chapter though it belongs to another: NABRE Wis 12:1 closing Wis 11, John 7:53 opening John 8. */
export function printedElsewhere(row: VerseRow, chapter: number): boolean {
  return row.printedChapter === chapter && row.chapter !== chapter;
}

/** The Hebrew numbers of this psalm's verses other than its own (VGCL 9 → [10]; none where they agree, or are not reported). */
export function otherPsalmNumbers(rows: VerseRow[], chapter: number): number[] {
  return psalmChapters(rows).filter((n) => n !== chapter);
}

/** "(23)", or "(9–10)" for a psalm the other count splits. */
export function psalmNote(numbers: number[]): string {
  return `(${numbers.length > 1 ? `${numbers[0]}–${numbers.at(-1)}` : numbers[0]})`;
}
