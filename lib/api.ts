import "server-only";
import { ESTHER } from "./esther";
import type { Access, Book, Chapter, Edition, EditionIndex, VerseRow } from "./types";

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

async function request(path: string, access: Access, init: FetchInit): Promise<unknown> {
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
    return await res.json();
  } catch {
    throw new ApiUnavailable("endpoint returned an unreadable body");
  }
}

const METADATA: FetchInit = { next: { revalidate: 86400 } };

export async function getEditions(): Promise<Edition[]> {
  const body = (await request("/metadata/bibleversions", "visitor", METADATA)) as {
    validversions?: string[];
    validversions_fullname?: Record<string, string>;
    copyrightversions?: string[];
  };
  const copyrighted = new Set(body.copyrightversions ?? []);
  const names = body.validversions_fullname ?? {};
  return (body.validversions ?? []).map((sigla) => {
    const [fullname = sigla, year = "", language = "", , , copyrightHolder = ""] = (names[sigla] ?? "").split("|");
    return { sigla, fullname, year, language, copyrightHolder, copyright: copyrighted.has(sigla) };
  });
}

type RawIndex = {
  abbreviations: string[];
  biblebooks: string[];
  chapter_limit: number[];
  verse_limit: number[][];
  book_num: number[];
};

const ESTHER_CHAPTERS = 10;

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
    };
    // An edition with both Esther texts reports 20 chapters: the Hebrew 1-10, then the Greek 1-10.
    if (book.bookNum === ESTHER && book.chapters === 2 * ESTHER_CHAPTERS) {
      book.chapters = ESTHER_CHAPTERS;
      book.greekVersesPerChapter = book.versesPerChapter.slice(ESTHER_CHAPTERS);
      book.versesPerChapter = book.versesPerChapter.slice(0, ESTHER_CHAPTERS);
    }
    return book;
  });
  return { sigla, books };
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
  chapter: number;
  verse: number;
  verse_label?: string | null;
  verseequiv?: string | null;
  printed_chapter?: number | null;
  text: string;
  title1?: string | null;
  title2?: string | null;
  title3?: string | null;
  title_position?: number | null;
  psalm_hebrew?: string | null;
};

function toRow(r: RawRow): VerseRow {
  const row: VerseRow = {
    chapter: r.chapter,
    verse: r.verse,
    label: r.verse_label ?? r.verseequiv ?? null,
    printedChapter: r.printed_chapter ?? null,
    text: r.text,
    titles: [r.title1, r.title2, r.title3].filter((t): t is string => !!t),
    titlePosition: r.title_position ?? null,
  };
  if (r.psalm_hebrew) row.psalmHebrew = r.psalm_hebrew;
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

function quoteRequest(p: ChapterParams, query: string): Promise<{ results?: RawRow[]; errors?: unknown[] }> {
  const qs = new URLSearchParams({ query, version: p.sigla });
  if (p.numbering !== "hebrew") qs.set("numbering", "edition");
  qs.set("return", "json");
  if (p.tradition) qs.set("text_tradition", p.tradition);
  const init: FetchInit = p.access === "reader" ? { cache: "no-store" } : { next: { revalidate: 3600 } };
  return request(`/quote?${qs}`, p.access, init) as Promise<{ results?: RawRow[]; errors?: unknown[] }>;
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
  const rows = results.map(toRow);
  if (!index) return { rows, truncated: false, expectedVerses: rows.length };
  const book = index.books.find((b) => b.abbrev === p.bookAbbrev);
  // Esther with both texts: count the verses of the text requested (Greek, the API's default, unless HEBREW).
  const counts = book?.greekVersesPerChapter && p.tradition !== "HEBREW" ? book.greekVersesPerChapter : book?.versesPerChapter;
  const expectedVerses = counts?.[p.chapter - 1];
  if (expectedVerses === undefined) throw new NotFound(`${p.bookAbbrev} ${p.chapter} is not in ${p.sigla}`);
  return { rows, truncated: rows[rows.length - 1].verse < expectedVerses, expectedVerses };
}

/**
 * The rows of one verse (all its printed parts), or none when the endpoint has no such verse.
 * Used for the first verse of the next chapter, which an edition may print at the end of this one.
 */
export async function getVerses(p: ChapterParams & { verse: number }): Promise<VerseRow[]> {
  const body = await quoteRequest(p, `${p.bookAbbrev}${p.chapter}:${p.verse}`);
  return (body.results ?? []).map(toRow);
}
