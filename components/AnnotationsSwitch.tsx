"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { loadAnnotations, saveAnnotations, subscribeAnnotations } from "@/lib/annotations";

/** The attributes a mention's first piece takes while the marks are on: its one stop for focus and for the card. */
const FOCUS = { tabindex: "0", role: "button", "aria-haspopup": "dialog" } as const;

function focusTargets(root: Element, on: boolean) {
  for (const el of root.querySelectorAll("[data-mention-first]")) {
    for (const [name, value] of Object.entries(FOCUS)) {
      if (on) el.setAttribute(name, value);
      else el.removeAttribute(name);
    }
  }
}

/**
 * The reader bar's Annotations switch. The reader (the page's `<main>`, else the body) carries
 * `data-annotations="on|off"`, which the stylesheet reads to show the marks; while on, the first piece of each mention
 * becomes a button (also for text that arrives later, such as the next chapter).
 */
export function AnnotationsSwitch() {
  const t = useTranslations("Reader.annotations");
  const on = useSyncExternalStore(subscribeAnnotations, loadAnnotations, () => false);
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const root = box.current?.closest("main") ?? document.body;
    root.setAttribute("data-annotations", on ? "on" : "off");
    focusTargets(root, on);
    if (!on) return;
    const watch = new MutationObserver(() => focusTargets(root, true));
    watch.observe(root, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, [on]);

  return (
    <label className="mr-2 flex shrink-0 cursor-pointer items-center gap-1.5 text-sm" title={t("title")}>
      <input ref={box} type="checkbox" role="switch" className="peer sr-only" checked={on} onChange={(e) => saveAnnotations(e.target.checked)} />
      <span
        aria-hidden
        className={
          "relative h-5 w-9 shrink-0 rounded-full bg-slate-300 transition-colors dark:bg-slate-600 " +
          "peer-checked:bg-slate-700 dark:peer-checked:bg-slate-300 peer-focus-visible:ring-2 peer-focus-visible:ring-slate-500/60 " +
          "after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white " +
          "after:shadow after:transition-transform peer-checked:after:translate-x-4 dark:peer-checked:after:bg-slate-900"
        }
      />
      <span className="max-sm:sr-only">{t("label")}</span>
    </label>
  );
}
