"use client";

import { useTranslations } from "next-intl";
import { themeCookie, type Theme } from "@/lib/theme";

const DARK = "(prefers-color-scheme: dark)";

/**
 * One button between light and dark. Without a saved choice the site follows the system; a click switches to the
 * other theme and saves it, unless that is the system's own, in which case the saved choice is dropped and the
 * site follows the system again. The choice goes on <html data-theme> at once and into a cookie, so the next page
 * is rendered with it on the server.
 *
 * The icon and the label shown come from CSS (the dark: variant, which reads data-theme, else the system), so the
 * button is right from the first paint, before any script runs.
 */
export function ThemeSwitch() {
  const t = useTranslations("Theme");
  const toggle = () => {
    const root = document.documentElement;
    const systemDark = window.matchMedia(DARK).matches;
    const shownDark = root.dataset.theme ? root.dataset.theme === "dark" : systemDark;
    const next: Theme = shownDark ? "light" : "dark";
    // Landing on the system's own theme: forget the choice, so the site follows the system again.
    const choice: Theme = (next === "dark") === systemDark ? "system" : next;
    if (choice === "system") delete root.dataset.theme;
    else root.dataset.theme = choice;
    document.cookie = themeCookie(choice);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {/* Light now: a moon, to switch to dark. Dark now: a sun, to switch to light. */}
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dark:hidden">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hidden dark:block">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <span className="sr-only dark:hidden">{t("toDark")}</span>
      <span className="hidden dark:inline sr-only">{t("toLight")}</span>
    </button>
  );
}
