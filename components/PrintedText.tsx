import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { OtherEditionLink } from "@/components/OtherEdition";
import { noteRuns } from "@/lib/notes";
import type { PrintedPiece } from "@/lib/types";

const linkClass = "text-red-700 underline-offset-2 hover:underline dark:text-red-400";

/**
 * Printed text (a note's body, an introduction's paragraph): `<i>`, `<b>` and `<sm>` as formatting, each citation a
 * link (one into another edition with its small book), and after each verified misprint, left as printed, a note
 * "[sic! expected: …]" in rubric red, set upright with *sic!* in italics, the intended passage linked.
 */
export function PrintedText({ text, refs, sic = [] }: PrintedPiece): ReactNode {
  const t = useTranslations("Reader");
  // The misprints first, so that a misprinted citation (whose link would be wrong) is cut as the misprint.
  const runs = noteRuns(text, [...sic, ...refs]);
  const styled = (r: (typeof runs)[number], k: number) => {
    let n: ReactNode = r.text;
    if (r.sm) n = <span className="bg-sm">{n}</span>;
    if (r.b) n = <b>{n}</b>;
    if (r.i) n = <i>{n}</i>;
    return <span key={k}>{n}</span>;
  };
  const out: ReactNode[] = [];
  for (let i = 0; i < runs.length; ) {
    const at = runs[i].ref;
    let j = i;
    while (j < runs.length && runs[j].ref === at) j++;
    const parts = runs.slice(i, j).map((r, k) => styled(r, i + k));
    if (at !== undefined && at < sic.length) {
      const s = sic[at];
      out.push(
        <span key={i}>
          {parts}{" "}
          <span className="bg-sic">
            [{t.rich("sic", {
              intended: s.intended,
              i: (c) => <i>{c}</i>,
              ref: (c) => (s.ref?.href ? <a data-nav="" href={s.ref.href} className="underline underline-offset-2">{c}</a> : c),
            })}]
          </span>
        </span>,
      );
    } else {
      const r = at === undefined ? undefined : refs[at - sic.length];
      if (r?.href && r.editionName) out.push(<OtherEditionLink key={i} href={r.href} name={r.editionName} className={linkClass}>{parts}</OtherEditionLink>);
      else out.push(r?.href ? <a key={i} data-nav="" href={r.href} className={linkClass}>{parts}</a> : parts);
    }
    i = j;
  }
  return out;
}
