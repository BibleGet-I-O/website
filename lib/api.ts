import "server-only";
import { versesIn } from "@/lib/chapters";
import { ESTHER } from "./esther";
import type { Access, Book, Chapter, Edition, EditionIndex, IntroBlock, IntroHeading, Introduction, Note, NoteMarker, NoteRef, PrintedPiece, Sic, VerseRow } from "./types";

export class ApiUnavailable extends Error {
  constructor(message = "The BibleGet endpoint is unavailable") {
    super(message);
    this.name = "ApiUnavailable";
  }
}

export class NotFound extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFound";
  }
}

type FetchInit = RequestInit & { next?: { revalidate: number } };

function baseUrl(): string {
  const url = process.env.BIBLEGET_API_URL;
  if (!url) throw new ApiUnavailable("BIBLEGET_API_URL is not set");
  return url.replace(/\/+$/, "");
}

function keyFor(access: Access): string {
  const key = access === "reader" ? process.env.BIBLEGET_READER_KEY : process.env.BIBLEGET_READ_KEY;
  if (!key) throw new ApiUnavailable("API key is not configured");
  return key;
}

const UNAVAILABLE_4XX = new Set([401, 403, 408, 429]);

/**
 * The endpoint's answer as it is, for callers that read its status themselves (search: 422 and 503 mean something
 * to the reader). Only an unreachable endpoint or a missing configuration throws (ApiUnavailable).
 */
export async function apiResponse(path: string, access: Access, init: FetchInit = { cache: "no-store" }): Promise<Response> {
  try {
    return await fetch(`${baseUrl()}${path}`, { ...init, headers: { Accept: "application/json", "X-Api-Key": keyFor(access) } });
  } catch (e) {
    if (e instanceof ApiUnavailable) throw e;
    throw new ApiUnavailable(e instanceof Error ? e.message : "network error");
  }
}

async function request(path: string, access: Access, init: FetchInit): Promise<unknown> {
  return (await requestWithHeaders(path, access, init)).body;
}

async function requestWithHeaders(path: string, access: Access, init: FetchInit): Promise<{ body: unknown; headers: Headers }> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: { Accept: "application/json", "X-Api-Key": keyFor(access) },
    });
  } catch (e) {
    if (e instanceof ApiUnavailable) throw e;
    throw new ApiUnavailable(e instanceof Error ? e.message : "network error");
  }
  if (res.status >= 500) throw new ApiUnavailable(`endpoint answered ${res.status}`);
  if (UNAVAILABLE_4XX.has(res.status)) {
    // A bad/revoked key or a rate limit is our problem, not a missing page. Log the status only, never the key.
    console.error(`BibleGet endpoint answered ${res.status} for ${path.split("?")[0]}`);
    throw new ApiUnavailable(`endpoint answered ${res.status}`);
  }
  if (res.status >= 400) throw new NotFound(`endpoint answered ${res.status}`);
  try {
    return { body: await res.json(), headers: res.headers };
  } catch {
    throw new ApiUnavailable("endpoint returned an unreadable body");
  }
}

const METADATA: FetchInit = { next: { revalidate: 86400 } };

type RawVersions = {
  validversions?: string[];
  validversions_fullname?: Record<string, string>;
  copyrightversions?: string[];
  liturgicalversions?: string[];
};

/** The editions metadata, one cached request shared by getEditions and getApiVersion. */
function bibleVersions(init: FetchInit = METADATA): Promise<{ body: unknown; headers: Headers }> {
  return requestWithHeaders("/metadata/bibleversions", "visitor", init);
}

export async function getEditions(): Promise<Edition[]> {
  const body = (await bibleVersions()).body as RawVersions;
  const copyrighted = new Set(body.copyrightversions ?? []);
  // An endpoint that predates the liturgical flag sends no list: no edition is liturgical (so too a malformed one).
  const list: unknown = body.liturgicalversions;
  const liturgical = new Set(Array.isArray(list) && list.every((v) => typeof v === "string") ? (list as string[]) : []);
  const names = body.validversions_fullname ?? {};
  return (body.validversions ?? []).map((sigla) => {
    const [fullname = sigla, year = "", language = "", , canon = "", copyrightHolder = "", ...rest] = (names[sigla] ?? "").split("|");
    // The notes are the last field: a "|" inside them must not cut them short.
    const notes = rest.join("|");
    return {
      sigla,
      fullname,
      year,
      language,
      canon: canon.trim().toUpperCase(),
      copyrightHolder,
      notes,
      copyright: copyrighted.has(sigla),
      liturgical: liturgical.has(sigla),
    };
  });
}

/** Longest version string shown; anything longer is cut (the header is untrusted text). */
const VERSION_MAX = 64;

/** How long the footer waits for the endpoint before showing no version. */
const VERSION_TIMEOUT_MS = 3000;

/**
 * The endpoint's release (its `X-BibleGet-Version` header), read from the cached editions metadata request;
 * null when the header is absent or empty, or the endpoint cannot be reached within three seconds. The
 * request carries an abort signal, and a timer bounds the wait as well, since a revalidating fetch ignores
 * the signal.
 */
export async function getApiVersion(): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), VERSION_TIMEOUT_MS);
  });
  const version = bibleVersions({ ...METADATA, signal: AbortSignal.timeout(VERSION_TIMEOUT_MS) }).then(
    ({ headers }) => {
      const value = headers.get("X-BibleGet-Version")?.trim();
      return value ? value.slice(0, VERSION_MAX) : null;
    },
    () => null,
  );
  try {
    return await Promise.race([version, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

type RawIndex = {
  abbreviations: string[];
  biblebooks: string[];
  chapter_limit: number[];
  verse_limit: number[][];
  book_num: number[];
  /** Each book's prologue verses (endpoint migration 065); absent from an older endpoint. */
  prologue?: number[];
};

const ESTHER_CHAPTERS = 10;

/**
 * Editions whose index reports Esther's two texts (20 chapters) but which print it once. The Nova Vulgata prints
 * the Hebrew text with the Greek additions as lettered verses; its Hebrew run in the database repeats the
 * unlettered verses, kept for queries until CBTUDR's links make it unnecessary (see the endpoint wiki,
 * Esther-Greek-and-Hebrew-Variants). It reads as one text: the Greek run, which is all of it.
 */
const ESTHER_PRINTED_ONCE = new Set(["NVBSE"]);

export async function getIndex(sigla: string): Promise<EditionIndex> {
  const body = (await request(`/metadata/versionindex?versions=${encodeURIComponent(sigla)}`, "visitor", METADATA)) as {
    indexes?: Record<string, RawIndex>;
  };
  const raw = body.indexes?.[sigla];
  if (!raw) throw new NotFound(`no index for ${sigla}`);
  const books: Book[] = raw.biblebooks.map((name, i) => {
    const book: Book = {
      bookNum: raw.book_num[i],
      name,
      abbrev: raw.abbreviations[i],
      chapters: raw.chapter_limit[i],
      versesPerChapter: raw.verse_limit[i],
      prologue: raw.prologue?.[i] ?? 0,
    };
    // An edition with both Esther texts reports 20 chapters: the Hebrew 1-10, then the Greek 1-10.
    if (book.bookNum === ESTHER && book.chapters === 2 * ESTHER_CHAPTERS) {
      book.chapters = ESTHER_CHAPTERS;
      if (ESTHER_PRINTED_ONCE.has(sigla)) {
        book.versesPerChapter = book.versesPerChapter.slice(ESTHER_CHAPTERS);
      } else {
        book.greekVersesPerChapter = book.versesPerChapter.slice(ESTHER_CHAPTERS);
        book.versesPerChapter = book.versesPerChapter.slice(0, ESTHER_CHAPTERS);
      }
    }
    return book;
  });
  return { sigla, books };
}

/** A title the edition prints in a book, with its level (1 the highest). */
export type OutlineTitle = { level: number; title: string; chapter: number; verse: number; segment: string | null; printedChapter: number | null };

const whole = (n: unknown, min: number): n is number => Number.isInteger(n) && (n as number) >= min;

/** One title of the endpoint's answer; null when malformed: an index is never worth a broken chapter page. */
function toTitle(x: unknown): OutlineTitle | null {
  if (typeof x !== "object" || x === null) return null;
  const { level, title, chapter, verse, segment = null, printed_chapter: printedChapter = null } = x as Record<string, unknown>;
  if (!whole(level, 1) || typeof title !== "string" || !whole(chapter, 0) || !whole(verse, 0)) return null;
  if (segment !== null && typeof segment !== "string") return null;
  if (printedChapter !== null && !whole(printedChapter, 0)) return null;
  return { level, title, chapter, verse, segment, printedChapter };
}

/**
 * A book's titles; signed-in readers also get those of the edition's commentary, where it prints none, and the name
 * of the book's introduction. Empty when it has none, or when the endpoint cannot say: the index (and the
 * introduction's icon) is then simply not offered.
 */
export async function getBookOutline(sigla: string, bookNum: number, access: Access): Promise<{ titles: OutlineTitle[]; introduction: { id: string; title: string } | null }> {
  try {
    const body = (await request(`/metadata/outline?version=${encodeURIComponent(sigla)}&book=${bookNum}`, access, access === "reader" ? { cache: "no-store" } : METADATA)) as {
      titles?: unknown;
      introduction?: unknown;
    } | null;
    const titles = Array.isArray(body?.titles) ? body.titles.flatMap((x: unknown) => toTitle(x) ?? []) : [];
    const named = toHeading({ ...(body?.introduction as object), books: [bookNum] });
    return { titles, introduction: named && { id: named.id, title: named.title } };
  } catch (err) {
    if (err instanceof NotFound || err instanceof ApiUnavailable) return { titles: [], introduction: null };
    throw err;
  }
}

/** A book's titles (see getBookOutline). */
export async function getOutline(sigla: string, bookNum: number, access: Access): Promise<OutlineTitle[]> {
  return (await getBookOutline(sigla, bookNum, access)).titles;
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isSpan = (x: unknown): x is [number, number] => Array.isArray(x) && x.length === 2 && x.every((n) => whole(n, 0));

/** A citation's passage; null when malformed. */
function toPassage(x: unknown): { start: NoteRef["start"]; end: NoteRef["end"] } | null {
  if (!isObject(x) || !isObject(x.start)) return null;
  const { book, chapter, verse = null, segment = null, printed_chapter: printedChapter = null } = x.start;
  if (!whole(book, 1) || !whole(chapter, 0) || (verse !== null && !whole(verse, 0))) return null;
  if ((segment !== null && typeof segment !== "string") || (printedChapter !== null && !whole(printedChapter, 0))) return null;
  const e = x.end ?? null;
  if (e !== null && !(isObject(e) && whole(e.book, 1) && whole(e.chapter, 0) && whole(e.verse, 0))) return null;
  return {
    start: { book, chapter, verse, segment, printedChapter },
    end: e === null ? null : { book: e.book as number, chapter: e.chapter as number, verse: e.verse as number },
  };
}

/** Printed text with its citations and misprints; null when the text is malformed (a bad citation is only dropped). */
function toPiece(x: unknown): PrintedPiece | null {
  if (!isObject(x) || typeof x.text !== "string") return null;
  const refs = (Array.isArray(x.refs) ? x.refs : []).flatMap((r: unknown) => {
    const p = toPassage(r);
    return p && isObject(r) && isSpan(r.span) ? [{ ...p, span: r.span }] : [];
  });
  const sic: Sic[] = (Array.isArray(x.sic) ? x.sic : []).flatMap((s: unknown) =>
    isObject(s) && isSpan(s.span) && typeof s.intended === "string" ? [{ span: s.span, intended: s.intended, ref: toPassage(s.ref) }] : []);
  return { text: x.text, refs, ...(sic.length > 0 && { sic }) };
}

function toBlock(x: unknown): IntroBlock | null {
  if (!isObject(x)) return null;
  if (x.type === "row") {
    if (!Array.isArray(x.cells)) return null;
    const cells = x.cells.map(toPiece);
    return cells.every((c): c is PrintedPiece => c !== null) ? { type: "row", cells } : null;
  }
  const p = toPiece(x);
  if (!p) return null;
  if (x.type === "paragraph") return { type: "paragraph", ...p };
  if ((x.type === "heading" || x.type === "item") && whole(x.level, 1)) return { type: x.type, level: x.level, ...p };
  return null;
}

function toHeading(x: unknown): IntroHeading | null {
  if (!isObject(x) || typeof x.id !== "string" || typeof x.title !== "string" || !Array.isArray(x.books)) return null;
  return x.books.every((b) => whole(b, 1)) ? { id: x.id, title: x.title, books: x.books as number[] } : null;
}

function toIntroduction(x: unknown): Introduction | null {
  const h = toHeading(x);
  if (!h || !isObject(x) || !Array.isArray(x.blocks)) return null;
  return { ...h, blocks: x.blocks.flatMap((b: unknown) => toBlock(b) ?? []) };
}

/**
 * A book's introduction (null when it has none) and the general introductions that cover it, in print order. For
 * signed-in readers only: the endpoint gives them to the reader key alone.
 */
export async function getIntroduction(sigla: string, bookNum: number): Promise<{ introduction: Introduction | null; general: IntroHeading[] }> {
  const body = (await request(`/metadata/introduction?version=${encodeURIComponent(sigla)}&book=${bookNum}`, "reader", { cache: "no-store" })) as Record<string, unknown> | null;
  return {
    introduction: toIntroduction(body?.introduction),
    general: Array.isArray(body?.general) ? body.general.flatMap((g: unknown) => toHeading(g) ?? []) : [],
  };
}

/** One general introduction by its id; null when the edition has none so named. Signed-in readers only. */
export async function getGeneralIntroduction(sigla: string, id: string): Promise<Introduction | null> {
  if (!/^[a-z0-9-]{1,40}$/.test(id)) return null;
  try {
    const body = (await request(`/metadata/introduction?version=${encodeURIComponent(sigla)}&id=${id}`, "reader", { cache: "no-store" })) as Record<string, unknown> | null;
    return toIntroduction(body?.introduction);
  } catch (err) {
    if (err instanceof NotFound) return null;
    throw err;
  }
}

type Sluggable = Pick<Book, "bookNum" | "name">;

/** The name's Latin letters and digits, hyphenated; `book-{n}` when none are left (a Greek-only name). */
function baseSlug(book: Sluggable): string {
  const latin = book.name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return latin || `book-${book.bookNum}`;
}

const slugCache = new WeakMap<readonly Sluggable[], Map<number, string>>();

/** Every book's slug in one edition: the base slug, suffixed `-{bookNum}` where two books would share it. */
function editionSlugs(books: readonly Sluggable[]): Map<number, string> {
  const cached = slugCache.get(books);
  if (cached) return cached;
  const bases = books.map(baseSlug);
  const count = new Map<string, number>();
  for (const b of bases) count.set(b, (count.get(b) ?? 0) + 1);
  const slugs = new Map(books.map((b, i) => [b.bookNum, count.get(bases[i])! > 1 ? `${bases[i]}-${b.bookNum}` : bases[i]]));
  slugCache.set(books, slugs);
  return slugs;
}

/**
 * A book's URL slug, unique and non-empty within its edition (`books`: the edition's index). Route
 * generation and bookBySlug both use it, so every book of the edition is reachable.
 */
export function slugFor(book: Sluggable, books: readonly Sluggable[]): string {
  return editionSlugs(books).get(book.bookNum) ?? baseSlug(book);
}

export function bookBySlug(index: EditionIndex, slug: string): Book | undefined {
  return index.books.find((b) => slugFor(b, index.books) === slug);
}

type RawRow = {
  univbooknum?: number | string;
  chapter: number;
  verse: number;
  verse_label?: string | null;
  verse_segment?: string | null;
  verseequiv?: string | null;
  printed_chapter?: number | null;
  text: string;
  title1?: string | null;
  title2?: string | null;
  title3?: string | null;
  title_position?: number | null;
  psalm_hebrew?: string | null;
  text_tradition?: string | null;
  omitted?: boolean;
  notes?: RawMarker[];
};

type RawMarker = { id: string; kind: string; marker: string | null; field: string; position: number | null };
type RawRef = {
  start: { book: number; chapter: number; verse: number | null; segment: string | null; printed_chapter: number | null };
  end: { book: number; chapter: number; verse: number } | null;
  span: [number, number];
  edition?: string;
};
type RawNote = { kind: string; marker: string | null; label: string | null; title: string | null; body: string; refs: RawRef[] };
type RawNotes = Record<string, RawNote>;
type QuoteBody = { results?: RawRow[]; errors?: unknown[]; notes?: RawNotes };

function toNote(id: string, n: RawNote): Note {
  return {
    id,
    edition: id.slice(0, id.indexOf(":")),
    kind: n.kind === "crossref" ? "crossref" : "footnote",
    marker: n.marker,
    label: n.label,
    title: n.title,
    body: n.body,
    refs: n.refs.map((r) => ({
      start: { book: r.start.book, chapter: r.start.chapter, verse: r.start.verse, segment: r.start.segment, printedChapter: r.start.printed_chapter },
      end: r.end,
      span: r.span,
      ...(r.edition && { edition: r.edition }),
    })),
  };
}

/**
 * A row's markers with their notes' bodies. `title1`-`title3` become the index into the row's `titles` (its
 * non-empty headings); a chapter-heading marker goes at the start of the text (the reader prints no chapter
 * heading). A marker whose note the response lacks is dropped.
 */
function toMarkers(r: RawRow, notes: RawNotes | undefined): NoteMarker[] | undefined {
  if (!r.notes?.length || !notes) return undefined;
  const titled = (["title1", "title2", "title3"] as const).filter((f) => !!r[f]);
  const out: NoteMarker[] = [];
  for (const m of r.notes) {
    const n = notes[m.id];
    if (!n) continue;
    const note = toNote(m.id, n);
    const t = titled.indexOf(m.field as (typeof titled)[number]);
    if (m.field.startsWith("title")) {
      if (t >= 0) out.push({ note, field: "title", titleIndex: t, position: m.position });
    } else if (m.field === "chapter") out.push({ note, field: "text", position: 0 });
    else out.push({ note, field: "text", position: m.position });
  }
  return out.length ? out : undefined;
}

function toRow(r: RawRow, notes?: RawNotes): VerseRow {
  const row: VerseRow = {
    chapter: r.chapter,
    verse: r.verse,
    segment: r.verse_segment ?? null,
    label: r.verse_label ?? r.verseequiv ?? null,
    printedChapter: r.printed_chapter ?? null,
    text: r.text,
    titles: [r.title1, r.title2, r.title3].filter((t): t is string => !!t),
    titlePosition: r.title_position ?? null,
  };
  if (r.psalm_hebrew) row.psalmHebrew = r.psalm_hebrew;
  if (r.text_tradition === "HEBREW") row.tradition = "HEBREW";
  if (r.omitted === true) row.omitted = true;
  const markers = toMarkers(r, notes);
  if (markers) row.notes = markers;
  return row;
}

export type ChapterParams = {
  sigla: string;
  bookAbbrev: string;
  chapter: number;
  access: Access;
  tradition?: string;
  numbering?: "edition" | "hebrew";
};

function quoteRequest(p: ChapterParams, query: string): Promise<QuoteBody> {
  const qs = new URLSearchParams({ query, version: p.sigla });
  if (p.numbering !== "hebrew") qs.set("numbering", "edition");
  qs.set("return", "json");
  if (p.tradition) qs.set("text_tradition", p.tradition);
  // Notes are for signed-in readers: the API gives them to the reader key only (403 to any other).
  if (p.access === "reader") qs.set("footnotes", "full");
  const init: FetchInit = p.access === "reader" ? { cache: "no-store" } : { next: { revalidate: 3600 } };
  return request(`/quote?${qs}`, p.access, init) as Promise<QuoteBody>;
}

/** A verse of a passage, with the book it is in (a reference can span books). */
export type PassageRow = VerseRow & { bookNum: number };

/**
 * The verses of a Bible reference as the reader typed it (`Jonah 1:1-2:2;3:2`, in any language and notation the
 * endpoint reads), in edition numbering. `readable` is false when the endpoint could not read it (400/422, or no
 * verses); `partial` when it read only part of it (verses and errors); `capped` when it cut this edition's
 * passage at the copyright cap.
 */
export async function getPassage(p: { sigla: string; query: string; access: Access }): Promise<{ rows: PassageRow[]; capped: boolean; readable: boolean; partial: boolean }> {
  const qs = new URLSearchParams({ query: p.query, version: p.sigla, numbering: "edition", return: "json" });
  const init: FetchInit = p.access === "reader" ? { cache: "no-store" } : { next: { revalidate: 3600 } };
  let body: { results?: RawRow[]; errors?: unknown[]; notices?: { code?: string; version?: string }[] };
  try {
    body = (await request(`/quote?${qs}`, p.access, init)) as typeof body;
  } catch (e) {
    if (e instanceof NotFound) return { rows: [], capped: false, readable: false, partial: false };
    throw e;
  }
  const results = body.results ?? [];
  if (results.length === 0) return { rows: [], capped: false, readable: false, partial: false };
  const capped = (body.notices ?? []).some((n) => n.code === "VERSES_CAPPED" && n.version === p.sigla);
  return { rows: results.map((r) => ({ ...toRow(r), bookNum: Number(r.univbooknum ?? 0) })), capped, readable: true, partial: (body.errors?.length ?? 0) > 0 };
}

export async function getChapter(p: ChapterParams): Promise<Chapter> {
  const hebrew = p.numbering === "hebrew";
  // In Hebrew mode the requested chapter is a Hebrew psalm number, which maps to a different edition chapter
  // (or two), so the index cannot be consulted by it. The interlinear second edition is shown as returned;
  // the cap notice belongs to the main edition.
  const [body, index] = await Promise.all([
    quoteRequest(p, `${p.bookAbbrev}${p.chapter}`),
    hebrew ? Promise.resolve(null) : getIndex(p.sigla),
  ]);
  const results = body.results ?? [];
  if (results.length === 0) {
    throw new NotFound((body.errors?.length ?? 0) > 0 ? "the endpoint rejected the query" : "no verses returned");
  }
  const rows = results.map((r) => toRow(r, body.notes));
  if (!index) return { rows, truncated: false, expectedVerses: rows.length };
  const book = index.books.find((b) => b.abbrev === p.bookAbbrev);
  // Esther with both texts: count the verses of the text requested (Greek, the API's default, unless HEBREW).
  const expectedVerses = book && versesIn(book, p.chapter, p.tradition);
  if (expectedVerses === undefined) throw new NotFound(`${p.bookAbbrev} ${p.chapter} is not in ${p.sigla}`);
  return { rows, truncated: rows[rows.length - 1].verse < expectedVerses, expectedVerses };
}

/**
 * The rows of one verse (all its printed parts), or none when the endpoint has no such verse.
 * Used for the first verse of the next chapter, which an edition may print at the end of this one.
 */
export async function getVerses(p: ChapterParams & { verse: number }): Promise<VerseRow[]> {
  const body = await quoteRequest(p, `${p.bookAbbrev}${p.chapter}:${p.verse}`);
  return (body.results ?? []).map((r) => toRow(r, body.notes));
}
