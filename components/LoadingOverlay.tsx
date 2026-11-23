"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

/** A navigation that has not arrived by then has failed, or the connection is slow: the reader is not kept waiting behind it. */
const GIVE_UP_MS = 15_000;

/**
 * Covers the reader while another chapter loads, so the one being left is not seen again. Escape, a tap, or a
 * navigation that does not arrive dismisses it (the navigation itself goes on).
 */
export function LoadingOverlay({ onDismiss }: { onDismiss: () => void }) {
  const t = useTranslations("Reader");
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
    <div role="status" aria-label={t("loading")} onClick={onDismiss} className="fixed inset-0 z-50 grid place-items-center bg-white dark:bg-slate-950">
      <span aria-hidden="true" className="size-10 rounded-full border-4 border-slate-200 border-t-red-700 motion-safe:animate-spin motion-reduce:animate-pulse dark:border-slate-800 dark:border-t-red-400" />
    </div>
  );
}
