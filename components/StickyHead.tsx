"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type HeadColumn = { key: string; label: ReactNode; lang?: string; className?: string };

const nameClass = "text-center font-sans text-xs font-semibold text-slate-600 sm:text-sm dark:text-slate-400";

/**
 * The top of a chapter that stays in view while it scrolls: the book and chapter, the editions' names when
 * comparing (`columns`, laid out with the page's own `gridClass` so each sits over its column), and a running head
 * per column: the last section heading scrolled past. Headings take part by carrying `data-head-col` (their
 * column's index), and `data-head-text` when they are printed in a group: the group's last heading, shown as soon as
 * its first is passed; `tools` sit on the title's line; `running` is how many columns have one (1 in a single column or interlinear).
 */
export function StickyHead({ title, columns, gridClass, running, tools }: { title: string; columns: HeadColumn[]; gridClass: string; running: number; tools?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [heads, setHeads] = useState<string[]>([]);

  useEffect(() => {
    const strip = ref.current;
    const page = strip?.parentElement;
    if (!strip || !page) return;
    const update = () => {
      // A heading counts as passed once its top reaches the strip's bottom edge.
      const edge = strip.getBoundingClientRect().bottom;
      const next = Array.from({ length: running }, (_, c) => {
        let text = "";
        for (const h of page.querySelectorAll<HTMLElement>(`[data-head-col="${c}"]`)) {
          if (h.getBoundingClientRect().top <= edge) text = h.dataset.headText ?? h.textContent ?? "";
        }
        return text;
      });
      setHeads((prev) => (prev.length === next.length && prev.every((h, i) => h === next[i]) ? prev : next));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [running]);

  return (
    <div
      ref={ref}
      data-sticky-head=""
      className="sticky top-0 z-20 -mx-4 mb-4 border-b border-slate-200 bg-white px-4 py-2 sm:-mx-6 sm:px-6 dark:border-slate-800 dark:bg-slate-950"
    >
      {/* Equal sides keep the title centred, with or without tools. */}
      <div data-title-line="" className="grid grid-cols-[minmax(2.25rem,1fr)_auto_minmax(2.25rem,1fr)] items-center gap-2">
        <span />
        <h1 className="text-center font-sans text-xl font-semibold sm:text-2xl">{title}</h1>
        <span className="flex justify-end">{tools}</span>
      </div>
      {columns.length > 0 && (
        <div className={gridClass}>
          {columns.map((c) => (
            <p key={c.key} data-testid="column-name" lang={c.lang} className={c.className ?? nameClass}>
              {c.label}
            </p>
          ))}
        </div>
      )}
      {heads.some(Boolean) && (
        <div className={running > 1 ? gridClass : undefined}>
          {heads.map((h, i) => (
            <p key={i} data-running="" className="truncate font-serif text-sm font-semibold italic text-slate-700 dark:text-slate-300">
              {h}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
