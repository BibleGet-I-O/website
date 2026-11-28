import { editionSlug } from "@/lib/slug";

/**
 * The names, description, letter and index link of a CBPPEDR entry: shared by the index pages (lib/entities, server)
 * and the reader's cards (components/MentionCard, client), so nothing here may import the API.
 */

/** The three catalogs of CBPPEDR (CatholicOS/cbppedr). */
export const ENTITY_TYPES = ["person", "place", "event"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

type Names = Partial<Record<"la" | "it" | "en", string>>;

const NAME_LANGS = ["la", "it", "en"] as const;
type NameLang = (typeof NAME_LANGS)[number];
/** The catalog's name for an edition's language: Latin for any language CBPPEDR has no names in (BLPD). */
const nameLang = (lang: string): NameLang => ((NAME_LANGS as readonly string[]).includes(lang) ? (lang as NameLang) : "la");

/** What the names helpers read: an index entry (lib/entities Entity) or a card's entity (lib/types MentionEntity). */
type Named = { id: string; names: Names };

/** The entry's name as the edition's language has it, else the English, else the Italian. */
export function displayName(e: Named, editionLang: string): string {
  return e.names[nameLang(editionLang)] || e.names.en || e.names.it || e.names.la || e.id;
}

/** The name in the interface language (Italian or English), where it differs from the displayed one. */
export function otherName(e: Named, editionLang: string, locale: string): string | null {
  if (locale !== "it" && locale !== "en") return null;
  const name = e.names[locale];
  return name && name !== displayName(e, editionLang) ? name : null;
}

/** CBPPEDR's description in Italian for an Italian reader, otherwise in English. */
export function description(e: { description: Partial<Record<"it" | "en", string>> }, locale: string): string | null {
  return (locale === "it" ? e.description.it || e.description.en : e.description.en || e.description.it) ?? null;
}

/** A name for sorting and filing: no accents, no ʾ ʿ ', lower case. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").replace(/[ʾʿ'’]/g, "").toLowerCase();
}

/** The letter an entry is filed under on its index page (A–Z, or "#" for a name with no Latin letter). */
export function letterOf(e: Named, editionLang: string): string {
  return (fold(displayName(e, editionLang)).match(/[a-z]/)?.[0] ?? "#").toUpperCase();
}

/** The index page of a type (persons, places, events) of an edition, locale-less. */
export const INDEX_PATHS: Record<EntityType, string> = { person: "persons", place: "places", event: "events" };

/** Where an entry is on its edition's index: its type's page, at its letter, at its anchor (`#<id>`); `back`, the reader page it is opened from. */
export function indexEntryHref(e: Named, type: EntityType, sigla: string, editionLang: string, back?: string): string {
  const keep = back ? `&back=${encodeURIComponent(back)}` : "";
  return `/read/${editionSlug(sigla)}/${INDEX_PATHS[type]}?letter=${encodeURIComponent(letterOf(e, editionLang))}${keep}#${e.id}`;
}
