import { ApiUnavailable, apiResponse, slugFor } from "@/lib/api";
import { editionSlug } from "@/lib/slug";
import type { Book } from "@/lib/types";

/** The three catalogs of CBPPEDR (CatholicOS/cbppedr). */
export const ENTITY_TYPES = ["person", "place", "event"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/**
 * A verse of the edition where an entry is attested; `tradition` is Esther's text in editions that print both; `label`
 * what the edition prints for it when not its number (NABRE's Greek Esther "E:21", "12:1"); `printedChapter` the chapter
 * under whose heading it is printed, when not its own (NABRE Wis 12:1 under 11).
 */
export type EntityRef = {
  book: number;
  chapter: number;
  verse: number;
  segment: string | null;
  tradition: "GREEK" | "HEBREW" | null;
  label: string | null;
  printedChapter: number | null;
};

/** An entry of an edition's index, as /metadata/entities sends it (`qid_status` → `qidStatus`, refs as objects). */
export type Entity = {
  id: string;
  kind: string;
  names: Partial<Record<"la" | "it" | "en", string>>;
  description: Partial<Record<"it" | "en", string>>;
  qid: string | null;
  qidStatus: string | null;
  uncertain: boolean;
  refs: EntityRef[];
};

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const whole = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0;

function strings<K extends string>(x: unknown, keys: readonly K[]): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  if (isRecord(x)) for (const k of keys) if (typeof x[k] === "string") out[k] = x[k] as string;
  return out;
}

/** A verse tuple [book, chapter, verse, segment, tradition] or with [label, printed chapter] after; null when malformed. */
function toRef(x: unknown): EntityRef | null {
  if (!Array.isArray(x) || (x.length !== 5 && x.length !== 7)) return null;
  const [book, chapter, verse, segment, tradition, label = null, printedChapter = null] = x;
  if (!whole(book) || !whole(chapter) || !whole(verse)) return null;
  if (segment !== null && typeof segment !== "string") return null;
  if (tradition !== null && tradition !== "GREEK" && tradition !== "HEBREW") return null;
  if (label !== null && typeof label !== "string") return null;
  if (printedChapter !== null && !whole(printedChapter)) return null;
  return { book, chapter, verse, segment, tradition, label, printedChapter };
}

/** One entry of the endpoint's answer; null when malformed (an index is never worth a broken page). */
export function toEntity(x: unknown): Entity | null {
  if (!isRecord(x) || typeof x.id !== "string" || typeof x.kind !== "string") return null;
  return {
    id: x.id,
    kind: x.kind,
    names: strings(x.names, ["la", "it", "en"] as const),
    description: strings(x.description, ["it", "en"] as const),
    qid: typeof x.qid === "string" ? x.qid : null,
    qidStatus: typeof x.qid_status === "string" ? x.qid_status : null,
    uncertain: x.uncertain === true,
    refs: Array.isArray(x.refs) ? x.refs.flatMap((r) => toRef(r) ?? []) : [],
  };
}

/**
 * An edition's index of one type, from the endpoint (cached a day, with the site's read key). Empty when the endpoint
 * cannot say: the page then says the edition has no index yet, and the reader is unaffected.
 */
export async function getEntityIndex(sigla: string, type: EntityType): Promise<Entity[]> {
  try {
    const res = await apiResponse(`/metadata/entities?version=${encodeURIComponent(sigla)}&type=${type}`, "visitor", { next: { revalidate: 86400 } });
    if (!res.ok) return [];
    const body: unknown = await res.json();
    const entries = isRecord(body) && Array.isArray(body.entries) ? body.entries : [];
    return entries.flatMap((x: unknown) => toEntity(x) ?? []);
  } catch (err) {
    if (err instanceof ApiUnavailable || err instanceof SyntaxError) return [];
    throw err;
  }
}

const NAME_LANGS = ["la", "it", "en"] as const;
type NameLang = (typeof NAME_LANGS)[number];
/** The catalog's name for an edition's language: Latin for any language CBPPEDR has no names in (BLPD). */
const nameLang = (lang: string): NameLang => ((NAME_LANGS as readonly string[]).includes(lang) ? (lang as NameLang) : "la");

/** The entry's name as the edition's language has it, else the English, else the Italian. */
export function displayName(e: Entity, editionLang: string): string {
  return e.names[nameLang(editionLang)] || e.names.en || e.names.it || e.names.la || e.id;
}

/** The name in the interface language (Italian or English), where it differs from the displayed one. */
export function otherName(e: Entity, editionLang: string, locale: string): string | null {
  if (locale !== "it" && locale !== "en") return null;
  const name = e.names[locale];
  return name && name !== displayName(e, editionLang) ? name : null;
}

/** CBPPEDR's description in Italian for an Italian reader, otherwise in English. */
export function description(e: Entity, locale: string): string | null {
  return (locale === "it" ? e.description.it || e.description.en : e.description.en || e.description.it) ?? null;
}

/** Only a reviewed or adjudicated Wikidata item is shown: the automatic matches are still unreviewed. */
export const showsWikidata = (e: Entity): boolean => e.qid !== null && (e.qidStatus === "reviewed" || e.qidStatus === "adjudicated");

/** A name for sorting and filing: no accents, no ʾ ʿ ', lower case. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").replace(/[ʾʿ'’]/g, "").toLowerCase();
}

/** The entries by initial (A–Z, in order), each letter sorted by folded name, then id. */
export function byLetter(entities: Entity[], editionLang: string): Map<string, Entity[]> {
  const keyed = entities.map((e) => ({ e, key: fold(displayName(e, editionLang)) }));
  keyed.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.e.id < b.e.id ? -1 : a.e.id > b.e.id ? 1 : 0));
  const letters = new Map<string, Entity[]>();
  for (const { e, key } of keyed) {
    const letter = (key.match(/[a-z]/)?.[0] ?? "#").toUpperCase();
    letters.set(letter, [...(letters.get(letter) ?? []), e]);
  }
  return new Map([...letters].sort(([a], [b]) => (a < b ? -1 : 1)));
}

export type RefGroup = { book: string; parts: { label: string; href: string }[] };

/**
 * The verses grouped by book, in the order given, in the edition's abbreviations: consecutive whole verses of one
 * chapter merge ("11:26–27"), a later verse of the same chapter is its number alone ("29"); each links to the reader.
 * A verse the edition prints otherwise shows what it prints ("E:21"), never merged, and links to the chapter that prints
 * it, at its own anchor.
 */
export function compactRefs(refs: EntityRef[], books: Book[], sigla: string): RefGroup[] {
  const groups: RefGroup[] = [];
  // The part being written: its group, its prefix ("11:" or none), its first verse and the last ref it covers.
  type Open = { group: RefGroup; part: { label: string; href: string }; prefix: string; from: number; last: EntityRef };
  let open: Open | null = null as Open | null;
  for (const r of refs) {
    const book = books.find((b) => b.bookNum === r.book);
    if (!book) continue;
    const prev: EntityRef | undefined = open?.last;
    const sameBook = prev !== undefined && prev.book === r.book;
    const sameChapter = prev !== undefined && sameBook && prev.chapter === r.chapter && prev.tradition === r.tradition;
    const plain = (x: EntityRef) => !x.segment && x.label === null && x.printedChapter === null;
    if (open && prev && sameChapter && plain(r) && plain(prev) && r.verse === prev.verse + 1) {
      open.part.label = `${open.prefix}${open.from}–${r.verse}`;
      open.last = r;
      continue;
    }
    const group: RefGroup = sameBook && open ? open.group : { book: book.abbrev, parts: [] };
    if (group !== open?.group) groups.push(group);
    const prefix = sameChapter && r.printedChapter === null ? "" : `${r.chapter}:`;
    const query = r.tradition ? `?tradition=${r.tradition}` : "";
    const part = {
      label: r.label ?? `${prefix}${r.verse}${r.segment ?? ""}`,
      href: `/read/${editionSlug(sigla)}/${slugFor(book, books)}/${r.printedChapter ?? r.chapter}${query}#v${r.chapter}.${r.verse}${r.segment ?? ""}`,
    };
    group.parts.push(part);
    open = { group, part, prefix, from: r.verse, last: r };
  }
  return groups;
}
