import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { PrintedText } from "@/components/PrintedText";
import type { IntroBlock, Introduction } from "@/lib/types";

const ITEM_INDENT = ["pl-0", "pl-6", "pl-12"];

/**
 * An introduction as the edition prints it: its title, then its headings, paragraphs, outline items (each with its own
 * numeral, as a list indented by level) and table rows (as one table), citations linked and misprints noted; at its
 * end, the general introductions that cover the book.
 */
export function IntroductionView({ heading, intro, lang, general }: {
  heading: string;
  intro: Introduction;
  lang?: string;
  general: { title: string; href: string }[];
}) {
  const t = useTranslations("Reader");
  // Consecutive items make one list, consecutive rows one table; a list right after a heading is named by it.
  const groups: { kind: "item" | "row" | "one"; blocks: IntroBlock[]; at: number }[] = [];
  intro.blocks.forEach((b, i) => {
    const kind = b.type === "item" || b.type === "row" ? b.type : "one";
    const last = groups.at(-1);
    if (last && kind !== "one" && last.kind === kind) last.blocks.push(b);
    else groups.push({ kind, blocks: [b], at: i });
  });
  const headingId = (i: number) => `intro-h${i}`;

  const out: ReactNode[] = groups.map((g) => {
    const before = intro.blocks[g.at - 1];
    const named = before?.type === "heading" ? { "aria-labelledby": headingId(g.at - 1) } : {};
    if (g.kind === "item") {
      return (
        <ul key={g.at} {...named} className="mb-4 list-none space-y-1">
          {g.blocks.map((b, k) => b.type === "item" && (
            <li key={k} data-level={b.level} className={ITEM_INDENT[Math.min(b.level - 1, ITEM_INDENT.length - 1)]}>
              <PrintedText {...b} />
            </li>
          ))}
        </ul>
      );
    }
    if (g.kind === "row") {
      return (
        <table key={g.at} className="mb-4 w-full border-collapse text-base">
          <tbody>
            {g.blocks.map((b, k) => b.type === "row" && (
              <tr key={k} className="border-b border-slate-200 dark:border-slate-800">
                {b.cells.map((c, n) => <td key={n} className="px-2 py-1 align-top"><PrintedText {...c} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    const b = g.blocks[0];
    if (b.type === "heading") {
      const H = b.level <= 1 ? "h2" : "h3";
      return <H key={g.at} id={headingId(g.at)} className={b.level <= 1 ? "mt-6 mb-2 text-xl font-semibold" : "mb-2 text-base font-semibold italic"}><PrintedText {...b} /></H>;
    }
    return b.type === "paragraph" ? <p key={g.at} className="mb-4"><PrintedText {...b} /></p> : null;
  });

  return (
    <article className="font-serif text-lg leading-relaxed">
      <h1 className="text-center font-sans text-xl font-semibold sm:text-2xl">{heading}</h1>
      {/* The title as printed, under the reader's heading; a general introduction's is the heading itself. */}
      {intro.title !== heading && <p lang={lang} className="mt-1 text-center font-sans text-sm tracking-wide text-slate-500 dark:text-slate-400">{intro.title}</p>}
      <div className="mb-6" />
      <div lang={lang}>{out}</div>
      {general.length > 0 && (
        <nav aria-labelledby="general-introductions" className="mt-8 border-t border-slate-200 pt-4 font-sans dark:border-slate-800">
          <h2 id="general-introductions" className="mb-2 text-base font-semibold">{t("generalIntroductions")}</h2>
          <ul lang={lang} className="space-y-1">
            {general.map((g) => (
              <li key={g.href}>
                <a data-nav="" href={g.href} className="text-red-700 underline-offset-2 hover:underline dark:text-red-400">{g.title}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </article>
  );
}
