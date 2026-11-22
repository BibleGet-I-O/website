import { describe, it, expect } from "vitest";
import { LOCALES } from "@/i18n/routing";
import en from "@/messages/en.json";
import it_ from "@/messages/it.json";
import es from "@/messages/es.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import pt from "@/messages/pt.json";

type Tree = { [k: string]: string | Tree };
const ALL: Record<string, Tree> = { en, it: it_, es, fr, de, pt };

function leaves(t: Tree, p = ""): [string, string][] {
  return Object.entries(t).flatMap(([k, v]) => (typeof v === "string" ? [[p + k, v] as [string, string]] : leaves(v, `${p}${k}.`)));
}

/** Strings that read the same in every language: names, and messages made only of placeholders. */
const SAME_EVERYWHERE = new Set(["Metadata.siteName", "Home.title", "Home.bookName", "Reader.heading", "Footer.repos.api", "Footer.apiVersion", "Review.nova", "Review.chapterTitle", "Reader.septuagintShort"]);

/** Words that some languages share with English (a cognate, not an untranslated string). */
const SHARED: Record<string, string[]> = {
  it: [],
  es: [],
  fr: ["Home.notes", "Footer.siteVersion", "Search.suggestions"],
  de: ["Reader.interlinear", "Footer.repos.website", "Theme.system", "Reader.masoreticShort", "Search.modes.hybrid"],
  pt: ["Reader.interlinear", "Footer.siteVersion"],
};

describe("messages", () => {
  const english = new Map(leaves(en));

  it.each(LOCALES.filter((l) => l !== "en"))("%sHasExactlyTheEnglishKeys", (l) => {
    expect(leaves(ALL[l]).map(([k]) => k).sort()).toEqual([...english.keys()].sort());
  });

  it.each(LOCALES.filter((l) => l !== "en"))("%sIsTranslated", (l) => {
    const untranslated = leaves(ALL[l])
      .filter(([k, v]) => v === english.get(k) && !SAME_EVERYWHERE.has(k) && !SHARED[l].includes(k))
      .map(([k]) => k);
    expect(untranslated).toEqual([]);
  });

  it.each(LOCALES.filter((l) => l !== "en"))("%sKeepsEveryPlaceholderAndTag", (l) => {
    const marks = (s: string) => [...s.matchAll(/\{(\w+)\}|<(\w+)>/g)].map((m) => m[0]).sort();
    for (const [k, v] of leaves(ALL[l])) expect([k, marks(v)]).toEqual([k, marks(english.get(k) ?? "")]);
  });
});
