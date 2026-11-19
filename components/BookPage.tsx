import { renderVerse } from "@/lib/formatted";
import { printedLabel } from "@/lib/placement";
import type { VerseRow } from "@/lib/types";

/**
 * The book view: one column of running text as in a printed Bible, the edition's section headings where
 * they fall and the printed verse numbers as superscripts. Text is the edition's, in its own language, with
 * its layout tags rendered (poetic lines, small capitals, speakers: see lib/formatted.tsx and the `.bg-`
 * rules in app/globals.css).
 */
export function BookPage({ heading, chapter, rows, lang }: { heading: string; chapter: number; rows: VerseRow[]; lang?: string }) {
  // A heading closes the running paragraph: group the verses into sections, each opened by its headings.
  // A mid-verse heading (`titlePosition` set) is printed inside its verse instead.
  const sections: { titles: string[]; rows: VerseRow[] }[] = [];
  for (const r of rows) {
    const before = r.titlePosition == null ? r.titles : [];
    if (sections.length === 0 || before.length > 0) sections.push({ titles: before, rows: [] });
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
          <p className="bg-text mb-4">
            {s.rows.map((r, j) => (
              <span key={j}>
                {renderVerse({
                  label: printedLabel(r, chapter),
                  text: r.text,
                  titles: r.titlePosition == null ? [] : r.titles,
                  titlePosition: r.titlePosition,
                })}{" "}
              </span>
            ))}
          </p>
        </section>
      ))}
    </article>
  );
}
