import type { Mention, MentionEntity } from "@/lib/types";

/** Editions whose rows the endpoint marks with persons and places (CBPPEDR mentions). */
export const MENTION_EDITIONS: ReadonlySet<string> = new Set(["NVBSE"]);

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const str = (x: unknown): x is string => typeof x === "string";

function strings<K extends string>(x: unknown, keys: readonly K[]): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  if (isRecord(x)) for (const k of keys) if (str(x[k])) out[k] = x[k];
  return out;
}

/** One mention of a row; null when malformed. `entry` (settled) xor `candidates` (under review). */
export function toMention(x: unknown): Mention | null {
  if (!isRecord(x)) return null;
  const { start, end, entry, candidates } = x;
  if (!Number.isInteger(start) || (start as number) < 0 || !Number.isInteger(end) || (end as number) <= (start as number)) return null;
  const range = { start: start as number, end: end as number };
  if (str(entry) && candidates === undefined) return { ...range, entry };
  if (entry === undefined && Array.isArray(candidates) && candidates.length > 0 && candidates.every(str)) {
    return { ...range, candidates: candidates as string[] };
  }
  return null;
}

/** A row's mentions, the malformed ones dropped; undefined when it has none. */
export function toMentions(x: unknown): Mention[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const out = x.map(toMention).filter((m): m is Mention => m !== null);
  return out.length ? out : undefined;
}

/** One entity of the quote's `entities`; null when malformed or not a person or a place (events are not marked). */
export function toMentionEntity(x: unknown, id = ""): MentionEntity | null {
  if (!isRecord(x) || (x.type !== "person" && x.type !== "place") || !str(x.kind)) return null;
  const e: MentionEntity = {
    id,
    type: x.type,
    kind: x.kind,
    names: strings(x.names, ["la", "it", "en"] as const),
    description: strings(x.description, ["it", "en"] as const),
    uncertain: x.uncertain === true,
    verseCount: Number.isInteger(x.verse_count) ? (x.verse_count as number) : 0,
  };
  const img = x.image;
  if (isRecord(img) && str(img.file) && str(img.author) && str(img.license) && str(img.license_url)) {
    e.image = { file: img.file, author: img.author, license: img.license, licenseUrl: img.license_url };
  }
  if (isRecord(x.wikipedia)) {
    const w: Record<string, string> = {};
    for (const [k, v] of Object.entries(x.wikipedia)) if (str(v)) w[k] = v;
    if (Object.keys(w).length) e.wikipedia = w;
  }
  const c = x.coords;
  if (isRecord(c) && typeof c.lat === "number" && typeof c.lon === "number") e.coords = { lat: c.lat, lon: c.lon };
  return e;
}

/** The quote's `entities` object, by id; absent or malformed entries are left out. */
export function toMentionEntities(x: unknown): Record<string, MentionEntity> {
  const out: Record<string, MentionEntity> = {};
  if (isRecord(x)) for (const [id, v] of Object.entries(x)) {
    const e = toMentionEntity(v, id);
    if (e) out[id] = e;
  }
  return out;
}

/** The mentions whose entity is known: a candidate list keeps the candidates that have one. */
export function withKnownEntities(mentions: Mention[] | undefined, entities: Record<string, MentionEntity>): Mention[] | undefined {
  if (!mentions) return undefined;
  const out: Mention[] = [];
  for (const m of mentions) {
    if (m.entry !== undefined) {
      if (entities[m.entry]) out.push(m);
    } else {
      const known = (m.candidates ?? []).filter((c) => entities[c]);
      if (known.length) out.push({ start: m.start, end: m.end, candidates: known });
    }
  }
  return out.length ? out : undefined;
}
