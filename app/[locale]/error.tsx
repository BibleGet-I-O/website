"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

/**
 * The error page for the home, books and chapter pages. In production a Server Component's error reaches
 * the browser without its name (only a digest), and the pages' only expected server failure is the
 * endpoint being down (ApiUnavailable), so a server error reads as "the Bible service is unavailable".
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("Error");
  useEffect(() => {
    console.error(error);
  }, [error]);
  const fromServer = error instanceof Error && (error.name === "ApiUnavailable" || "digest" in error);
  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      <p className="mt-2">{fromServer ? t("unavailable") : t("generic")}</p>
      <button type="button" onClick={() => retry()} className="mt-4 rounded border border-slate-300 px-3 py-1 dark:border-slate-700">
        {t("retry")}
      </button>
    </main>
  );
}
