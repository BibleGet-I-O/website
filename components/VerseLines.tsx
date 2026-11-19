import { renderVerse } from "@/lib/formatted";
import { printedLabel } from "@/lib/placement";
import type { VerseRow } from "@/lib/types";

const labelClass = "shrink-0 pt-1 text-right font-sans text-xs text-slate-500 dark:text-slate-400";
/** The number's margin, and the headings' indent past it: narrower in a compact (three-column) layout on a phone. */
const margin = (compact: boolean) => (compact ? { label: "w-4 sm:w-8", gap: "gap-1 sm:gap-2", indent: "ml-5 sm:ml-10" } : { label: "w-8", gap: "gap-2", indent: "ml-10" });

const midHeadingClass = (j: number) =>
  j === 0 ? "mt-4 mb-1 block font-semibold" : "mb-1 block text-base font-semibold italic";

/** The section headings printed before a verse (none when they fall inside it, at `titlePosition`). */
export function headingsBefore(row: VerseRow | undefined): string[] {
  return row && row.titlePosition == null ? row.titles : [];
}

/** Section headings set level with the verse text, past the number's margin. */
export function Headings({ titles, compact = false }: { titles: string[]; compact?: boolean }) {
  const { indent } = margin(compact);
  return titles.map((t, j) => (
    <h2 key={j} className={j === 0 ? `mt-4 mb-1 ${indent} font-semibold` : `mb-1 ${indent} text-base font-semibold italic`}>
      {t}
    </h2>
  ));
}

/**
 * One verse on its own line, its printed number in the margin and its section headings above it (or inside
 * it, at `titlePosition`). Poetic lines keep their relative indents but start level with the number.
 * `headings={false}` leaves the headings before the verse to the caller (the interlinear gives them a row);
 * `compact` narrows the number's margin on a phone (three columns side by side).
 */
export function VerseLine({ row, chapter, headings = true, compact = false }: { row: VerseRow; chapter: number; headings?: boolean; compact?: boolean }) {
  const mid = row.titlePosition != null;
  const m = margin(compact);
  return (
    <>
      {headings && <Headings titles={headingsBefore(row)} compact={compact} />}
      <p data-testid="verse-line" className={`flex ${m.gap}`}>
        <span className={`${m.label} ${labelClass}`}>{printedLabel(row, chapter)}</span>
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
