import { defineRouting } from "next-intl/routing";

/** The interface languages, English first. Every page URL starts with one: /it/read/…, /fr/… */
export const LOCALES = ["en", "it", "es", "fr", "de", "pt"] as const;
export type Locale = (typeof LOCALES)[number];

/** The reader's language for unprefixed URLs, which the language picker saves for a year. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Each language in its own name, for the picker. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English", it: "Italiano", es: "Español", fr: "Français", de: "Deutsch", pt: "Português",
};

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: "en",
  localePrefix: "always",
  // next-intl writes the cookie too (on a locale switch): the same year-long lifetime as the picker's.
  localeCookie: { name: LOCALE_COOKIE, maxAge: 31536000 },
});
