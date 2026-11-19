"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setFullText } from "@/app/[locale]/admin/editions/actions";

/**
 * One edition's full-text switch. A refused change (4xx) is rolled back with a message; a change whose
 * outcome is unknown (status 0: the request may have been applied) is not, the page is refreshed instead and
 * the switch waits, disabled, for the authoritative value. A changed `initial` (the list was refreshed) is
 * followed whenever no change is pending.
 */
export function FullTextSwitch({ sigla, initial }: { sigla: string; initial: boolean }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [seen, setSeen] = useState(initial);
  const [unknown, setUnknown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Adjusting state to a changed prop during render (react.dev "you might not need an effect").
  if (!pending && initial !== seen) {
    setSeen(initial);
    setOn(initial);
    if (unknown) {
      setUnknown(false);
      setError(null);
    }
  }

  function toggle() {
    const next = !on;
    setError(null);
    setOn(next);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof setFullText>>;
      try {
        result = await setFullText(sigla, next);
      } catch {
        result = { ok: false, status: 0 };
      }
      if (result.ok) return;
      if (result.status === 0) {
        setUnknown(true);
        setError(t("switchUnknown"));
        router.refresh();
        return;
      }
      setOn(!next);
      setError(result.status === 401 ? t("signInAgain") : result.status === 403 ? t("forbidden") : t("switchFailed"));
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={t("fullTextFor", { sigla })}
        disabled={pending || unknown}
        onClick={toggle}
        className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-60 ${on ? "bg-emerald-600" : "bg-slate-400"}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${on ? "translate-x-5" : ""}`} />
      </button>
      {error && (
        <span role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </span>
      )}
    </span>
  );
}
