"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

/** A navigation that has not arrived by then has failed, or the connection is slow: the reader is not kept waiting behind it. */
const GIVE_UP_MS = 15_000;

/**
 * Covers the reader while another chapter loads, so the one being left is not seen again. Escape, a tap, or a
 * navigation that does not arrive dismisses it (the navigation itself goes on). A modal dialog: what it covers takes no
 * focus or keys, and it lies above any open popover; focus goes back where it was.
 */
export function LoadingOverlay({ onDismiss }: { onDismiss: () => void }) {
  const t = useTranslations("Reader");
  const tg = useTranslations("GoTo");
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const before = document.activeElement;
    if (dialog && !dialog.open) dialog.showModal();
    close.current?.focus();
    return () => {
      dialog?.close();
      if (before instanceof HTMLElement && before.isConnected) before.focus();
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    const timer = setTimeout(onDismiss, GIVE_UP_MS);
    document.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onDismiss);
    window.addEventListener("pageshow", onDismiss);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onDismiss);
      window.removeEventListener("pageshow", onDismiss);
    };
  }, [onDismiss]);
  return (
    <dialog
      ref={ref}
      aria-label={t("loading")}
      onCancel={(e) => {
        e.preventDefault();
        onDismiss();
      }}
      onClick={onDismiss}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-white p-0 text-inherit dark:bg-slate-950"
    >
      <div role="status" aria-label={t("loading")} className="grid h-full place-items-center">
        <span aria-hidden="true" className="size-10 rounded-full border-4 border-slate-200 border-t-red-700 motion-safe:animate-spin motion-reduce:animate-pulse dark:border-slate-800 dark:border-t-red-400" />
      </div>
      <button ref={close} type="button" className="fixed right-4 top-4 rounded px-2 py-1 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-red-700">
        {tg("close")}
      </button>
    </dialog>
  );
}
