"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { cardLabel, MentionCard, type MarkTarget } from "@/components/MentionCard";
import { loadAnnotations, subscribeAnnotations } from "@/lib/annotations";
import { popupPosition } from "@/lib/popup-position";
import type { MentionEntity } from "@/lib/types";

/** Hover this long on a mark and its card opens; leave it (and its card) this long and the card closes. */
export const OPEN_DELAY = 300;
export const CLOSE_DELAY = 200;

export type MentionLayerProps = {
  /** What each mark names and in which edition, by its pieces' `data-mention` key (lib/mentions mentionKey). */
  marks: Record<string, MarkTarget>;
  entities: Record<string, MentionEntity>;
  /** The interface language. */
  locale: string;
};

/** The open card: its mark's key, whether a tap or the keyboard pinned it, whether the keyboard opened it. */
type Open = { key: string; pinned: boolean; keyboard: boolean };

/** The key of the mark a node is in (its innermost piece), if any. */
function keyOf(node: EventTarget | null): string | null {
  if (!(node instanceof Element)) return null;
  return node.closest<HTMLElement>(".bg-mention[data-mention]")?.dataset.mention ?? null;
}

/** A mark's first piece (its one stop for focus), else any of its pieces. */
function firstPiece(root: ParentNode, key: string): HTMLElement | null {
  const q = `[data-mention="${key.replace(/["\\]/g, "\\$&")}"]`;
  return root.querySelector<HTMLElement>(`${q}[data-mention-first]`) ?? root.querySelector<HTMLElement>(q);
}

/**
 * The cards of the persons and places marked in the reader (mounted once inside `<main>`). Listening on `<main>` for
 * the marks' pieces (`.bg-mention`, server-rendered with their key only): a mouse resting on a mark opens its card
 * after 300 ms and leaving the mark and the card closes it 200 ms later (the pieces of one mark count as one); a tap or
 * click pins it and a second one on the same mark closes it; Enter or Space on the mark's first piece opens it with
 * focus inside. Escape or a pointer down outside the card and the mark closes it, focus going back to the mark when it
 * was in the card. While the Annotations switch is off nothing answers.
 */
export function MentionLayer({ marks, entities, locale }: MentionLayerProps) {
  const t = useTranslations("Reader.mentions");
  const on = useSyncExternalStore(subscribeAnnotations, loadAnnotations, () => false);
  const here = useRef<HTMLSpanElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<Open | null>(null);
  // The listeners read the card's state and timers here, not from a render's closure.
  const current = useRef<Open | null>(null);
  const opening = useRef<{ key: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);

  const root = useCallback((): HTMLElement => here.current?.closest("main") ?? document.body, []);
  const show = useCallback((next: Open | null) => {
    current.current = next;
    setOpen(next);
  }, []);
  const cancelOpen = useCallback(() => {
    if (opening.current) clearTimeout(opening.current.timer);
    opening.current = null;
  }, []);
  const cancelClose = useCallback(() => {
    if (closing.current) clearTimeout(closing.current);
    closing.current = null;
  }, []);
  const close = useCallback(() => {
    cancelOpen();
    cancelClose();
    const was = current.current;
    if (!was) return;
    const focusInCard = card.current?.contains(document.activeElement) ?? false;
    show(null);
    if (focusInCard) firstPiece(root(), was.key)?.focus();
  }, [cancelClose, cancelOpen, root, show]);
  const closeSoon = useCallback(() => {
    if (!current.current || current.current.pinned) return;
    cancelClose();
    closing.current = setTimeout(close, CLOSE_DELAY);
  }, [cancelClose, close]);

  // The marks answer only while the switch is on.
  useEffect(() => {
    if (!on) {
      close();
      return;
    }
    const main = root();
    // Another page's marks (a chapter turned): a card whose mark is gone closes.
    if (current.current && !(current.current.key in marks)) show(null);
    const known = (key: string | null): key is string => key !== null && key in marks;
    const over = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const key = keyOf(e.target);
      if (!known(key)) return;
      if (current.current?.key === key) return cancelClose();
      if (current.current?.pinned || opening.current?.key === key) return;
      cancelOpen();
      opening.current = { key, timer: setTimeout(() => {
        opening.current = null;
        cancelClose();
        show({ key, pinned: false, keyboard: false });
      }, OPEN_DELAY) };
    };
    const out = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const key = keyOf(e.target);
      if (!known(key)) return;
      const to = e.relatedTarget;
      // Into another piece of the same mark (or a tag inside one), or into its card: still on the mark.
      if (keyOf(to) === key || (to instanceof Node && card.current?.contains(to))) return;
      if (opening.current?.key === key) cancelOpen();
      if (current.current?.key === key) closeSoon();
    };
    const click = (e: MouseEvent) => {
      const key = keyOf(e.target);
      if (!known(key)) return;
      cancelOpen();
      cancelClose();
      if (current.current?.key === key && current.current.pinned) close();
      else show({ key, pinned: true, keyboard: false });
    };
    const keydown = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const piece = e.target instanceof HTMLElement && e.target.matches(".bg-mention[data-mention-first]") ? e.target : null;
      const key = piece?.dataset.mention ?? null;
      if (!known(key)) return;
      e.preventDefault();
      cancelOpen();
      cancelClose();
      show({ key, pinned: true, keyboard: true });
    };
    main.addEventListener("pointerover", over);
    main.addEventListener("pointerout", out);
    main.addEventListener("click", click);
    main.addEventListener("keydown", keydown);
    return () => {
      main.removeEventListener("pointerover", over);
      main.removeEventListener("pointerout", out);
      main.removeEventListener("click", click);
      main.removeEventListener("keydown", keydown);
      cancelOpen();
      cancelClose();
    };
  }, [on, marks, root, show, close, closeSoon, cancelOpen, cancelClose]);

  // An open card: Escape, or a pointer down outside it and its mark, closes it.
  useEffect(() => {
    if (!open) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const down = (e: PointerEvent) => {
      const target = e.target;
      if (target instanceof Node && card.current?.contains(target)) return;
      if (keyOf(target) === open.key) return;
      close();
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", down);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", down);
    };
  }, [open, close]);

  // Beside the mark's first piece, following it as the page scrolls or the window resizes.
  const place = useCallback(() => {
    const node = card.current;
    const anchor = current.current && firstPiece(root(), current.current.key);
    if (!node || !anchor) return;
    const { top, left } = popupPosition(
      anchor.getBoundingClientRect(),
      { width: node.offsetWidth, height: node.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    );
    Object.assign(node.style, { top: `${top}px`, left: `${left}px`, visibility: "visible" });
  }, [root]);
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);
  useEffect(() => {
    if (open?.keyboard) card.current?.focus();
  }, [open]);

  const mark = open ? marks[open.key] : undefined;
  const several = (mark?.candidates?.length ?? 0) > 1;
  const enter = (e: ReactPointerEvent) => {
    if (e.pointerType === "mouse") cancelClose();
  };
  const leave = (e: ReactPointerEvent) => {
    if (e.pointerType === "mouse" && open && keyOf(e.relatedTarget) !== open.key) closeSoon();
  };
  return (
    <>
      <span ref={here} hidden />
      {open && mark && createPortal(
        <div
          ref={card}
          role="dialog"
          aria-label={cardLabel(mark, entities)}
          tabIndex={-1}
          onPointerEnter={enter}
          onPointerLeave={leave}
          style={{ top: 0, left: 0, visibility: "hidden" }}
          className={
            `fixed z-50 ${several ? "w-[44rem]" : "w-[22rem]"} max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto ` +
            "rounded-lg border border-slate-300 bg-white p-3 font-sans text-sm text-slate-900 shadow-lg outline-none " +
            "focus-visible:ring-2 focus-visible:ring-slate-500/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          }
        >
          <MentionCard mark={mark} entities={entities} locale={locale} />
          <button
            type="button"
            onClick={close}
            className="sr-only focus:not-sr-only focus:absolute focus:right-2 focus:top-2 focus:rounded focus:bg-slate-100 focus:px-2 focus:py-0.5 focus:text-xs dark:focus:bg-slate-800"
          >
            {t("close")}
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}
