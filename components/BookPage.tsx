import { printedLabel } from "@/lib/placement";
import type { VerseRow } from "@/lib/types";

/**
 * The book view: one column of running text as in a printed Bible, the edition's section headings where
 * they fall and the printed verse numbers as superscripts. Text is the edition's, in its own language.
 */
export function BookPage({ heading, chapter, rows, lang }: { heading: string; chapter: number; rows: VerseRow[]; lang?: string }) {
  // A heading closes the running paragraph: group the verses into sections, each opened by its headings.
  const sections: { titles: string[]; rows: VerseRow[] }[] = [];
  for (const r of rows) {
    if (sections.length === 0 || r.titles.length > 0) sections.push({ titles: r.titles, rows: [] });
    sections[sections.length - 1].rows.push(r);
  }
  return (
    <article lang={lang} className="font-serif text-lg leading-relaxed">
      <h1 className="mb-6 text-center text-3xl font-semibold">{heading}</h1>
      {sections.map((s, i) => (
        <section key={i}>
          {s.titles.map((t, j) => (
            <h2 key={j} className={j === 0 ? "mt-6 mb-2 text-xl font-semibold" : "mb-2 text-base font-semibold italic"}>
              {t}
            </h2>
          ))}
          <p className="mb-4">
            {s.rows.map((r, j) => {
              const label = printedLabel(r, chapter);
              return (
                <span key={j}>
                  {label && <sup className="mr-0.5 text-xs font-sans text-slate-500 dark:text-slate-400">{label}</sup>}
                  {r.text}{" "}
                </span>
              );
            })}
          </p>
        </section>
      ))}
    </article>
  );
}
