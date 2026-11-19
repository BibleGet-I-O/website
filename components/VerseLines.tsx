import { renderVerse } from "@/lib/formatted";
import { printedLabel } from "@/lib/placement";
import type { VerseRow } from "@/lib/types";

const labelClass = "w-8 shrink-0 pt-1 text-right font-sans text-xs text-slate-500 dark:text-slate-400";

const midHeadingClass = (j: number) =>
  j === 0 ? "mt-4 mb-1 block font-semibold" : "mb-1 block text-base font-semibold italic";

/**
 * One verse on its own line, its printed number in the margin and its section headings above it (or inside
 * it, at `titlePosition`). Poetic lines keep their relative indents but start level with the number.
 */
export function VerseLine({ row, chapter }: { row: VerseRow; chapter: number }) {
  const mid = row.titlePosition != null;
  return (
    <>
      {!mid && row.titles.map((t, j) => (
        <h2 key={j} className={j === 0 ? "mt-4 mb-1 ml-10 font-semibold" : "mb-1 ml-10 text-base font-semibold italic"}>
          {t}
        </h2>
      ))}
      <p data-testid="verse-line" className="flex gap-2">
        <span className={labelClass}>{printedLabel(row, chapter)}</span>
        <span className="bg-text bg-compact min-w-0">
          {renderVerse({ label: null, text: row.text, titles: mid ? row.titles : [], titlePosition: row.titlePosition, headingClass: midHeadingClass })}
        </span>
      </p>
    </>
  );
}

/** An edition's chapter one verse per line, as the interlinear sets it. */
export function VerseLines({ rows, chapter, lang }: { rows: VerseRow[]; chapter: number; lang?: string }) {
  return (
    <div lang={lang} className="space-y-1 font-serif text-lg leading-relaxed">
      {rows.map((r, i) => (
        <VerseLine key={i} row={r} chapter={chapter} />
      ))}
    </div>
  );
}
