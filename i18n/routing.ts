import { defineRouting } from "next-intl/routing";

/** The interface languages, English first. Every page URL starts with one: /it/read/…, /fr/… */
export const LOCALES = ["en", "it", "es", "fr", "de", "pt"] as const;
export type Locale = (typeof LOCALES)[number];

export const routing = defineRouting({ locales: LOCALES, defaultLocale: "en", localePrefix: "always" });
