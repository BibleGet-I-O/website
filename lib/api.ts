import "server-only";
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
  };
  const names = body.validversions_fullname ?? {};
  return (body.validversions ?? []).map((sigla) => {
    const [fullname = sigla, year = "", language = "", , , copyrightHolder = ""] = (names[sigla] ?? "").split("|");
    return { sigla, fullname, year, language, copyrightHolder };
  });
}

type RawIndex = {
  abbreviations: string[];
  biblebooks: string[];
  chapter_limit: number[];
  verse_limit: number[][];
  book_num: number[];
};

export async function getIndex(sigla: string): Promise<EditionIndex> {
  const body = (await request(`/metadata/versionindex?versions=${encodeURIComponent(sigla)}`, "visitor", METADATA)) as {
    indexes?: Record<string, RawIndex>;
  };
  const raw = body.indexes?.[sigla];
  if (!raw) throw new NotFound(`no index for ${sigla}`);
  const books: Book[] = raw.biblebooks.map((name, i) => ({
    bookNum: raw.book_num[i],
    name,
    abbrev: raw.abbreviations[i],
    chapters: raw.chapter_limit[i],
    versesPerChapter: raw.verse_limit[i],
  }));
  return { sigla, books };
}

export function slugFor(book: Pick<Book, "name">): string {
  return book.name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");
}

export function bookBySlug(index: EditionIndex, slug: string): Book | undefined {
  return index.books.find((b) => slugFor(b) === slug);
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

export async function getChapter(p: ChapterParams): Promise<Chapter> {
  const qs = new URLSearchParams({ query: `${p.bookAbbrev}${p.chapter}`, version: p.sigla });
  if ((p.numbering ?? "edition") === "edition") qs.set("numbering", "edition");
  qs.set("return", "json");
  if (p.tradition) qs.set("text_tradition", p.tradition);

  const init: FetchInit = p.access === "reader" ? { cache: "no-store" } : { next: { revalidate: 3600 } };
  const [body, index] = await Promise.all([
    request(`/quote?${qs}`, p.access, init) as Promise<{ results?: RawRow[]; errors?: unknown[] }>,
    getIndex(p.sigla),
  ]);
  const results = body.results ?? [];
  if (results.length === 0) {
    throw new NotFound((body.errors?.length ?? 0) > 0 ? "the endpoint rejected the query" : "no verses returned");
  }
  const book = index.books.find((b) => b.abbrev === p.bookAbbrev);
  const expectedVerses = book?.versesPerChapter[p.chapter - 1];
  if (expectedVerses === undefined) throw new NotFound(`${p.bookAbbrev} ${p.chapter} is not in ${p.sigla}`);
  const rows = results.map(toRow);
  return { rows, truncated: rows[rows.length - 1].verse < expectedVerses, expectedVerses };
}
