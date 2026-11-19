/** The reader's colour scheme: their own choice, or the system's (the default). */
export type Theme = "system" | "light" | "dark";

/** The cookie that keeps a chosen theme, so the server renders it and the page never flashes the other one. */
export const THEME_COOKIE = "theme";

/** A cookie value as a theme: anything but "light" or "dark" follows the system. */
export function parseTheme(value: string | undefined): Theme {
  return value === "light" || value === "dark" ? value : "system";
}

/** The `document.cookie` assignment that keeps a choice for a year; "system" deletes the cookie. */
export function themeCookie(theme: Theme): string {
  return theme === "system"
    ? `${THEME_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
    : `${THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
