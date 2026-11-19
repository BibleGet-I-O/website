"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { themeCookie, type Theme } from "@/lib/theme";

const THEMES: Theme[] = ["system", "light", "dark"];

/**
 * System / light / dark. The choice goes on <html data-theme> at once and into a cookie, so the next page
 * is rendered with it on the server; "system" removes both and follows prefers-color-scheme.
 */
export function ThemeSwitch({ initial }: { initial: Theme }) {
  const t = useTranslations("Theme");
  const [theme, setTheme] = useState<Theme>(initial);
  const choose = (next: Theme) => {
    setTheme(next);
    const root = document.documentElement;
    if (next === "system") delete root.dataset.theme;
    else root.dataset.theme = next;
    document.cookie = themeCookie(next);
  };
  return (
    <>
      <label className="sr-only" htmlFor="theme-switch">{t("label")}</label>
      <select
        id="theme-switch"
        value={theme}
        onChange={(e) => choose(e.target.value as Theme)}
        className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
      >
        {THEMES.map((v) => (
          <option key={v} value={v}>{t(v)}</option>
        ))}
      </select>
    </>
  );
}
