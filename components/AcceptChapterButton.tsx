"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { acceptChapter } from "@/app/[locale]/review/actions";

/** Accepts the chapter's remaining drafts. Shown only on the chapter's page, below its links. */
export function AcceptChapterButton({ edition, book, chapter }: { edition: string; book: number; chapter: number }) {
  const t = useTranslations("Review");
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "failed" | number>("idle");
  return (
    <div className="mt-6">
      <button
        type="button"
        className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy");
          const r = await acceptChapter(edition, book, chapter);
          setState(r.ok ? r.accepted : "failed");
          if (r.ok) router.refresh();
        }}
      >
        {t("acceptChapter")}
      </button>
      {typeof state === "number" && <p role="status" className="mt-1 text-sm">{t("acceptedChapter", { count: state })}</p>}
      {state === "failed" && <p role="alert" className="mt-1 text-sm text-red-700 dark:text-red-400">{t("failed")}</p>}
    </div>
  );
}
