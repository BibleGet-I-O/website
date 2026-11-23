import { editionSlug } from "@/lib/slug";

export type ReadAt = { bookNum: number; chapter: number };

const key = (sigla: string) => `bibleget.lastRead.${sigla}`;
const positive = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0;

/** The chapter last read in an edition, from this browser; null when none is stored or storage cannot be read. */
export function loadLastRead(sigla: string): ReadAt | null {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key(sigla)) ?? "null");
    if (typeof v !== "object" || v === null) return null;
    const { bookNum, chapter } = v as Record<string, unknown>;
    return positive(bookNum) && bookNum <= 73 && positive(chapter) ? { bookNum, chapter } : null;
  } catch {
    return null;
  }
}

/** Remembers the chapter on screen; storage that refuses (private mode, full) is not an error. */
export function saveLastRead(sigla: string, at: ReadAt): void {
  try {
    localStorage.setItem(key(sigla), JSON.stringify({ bookNum: at.bookNum, chapter: at.chapter }));
  } catch {
    // Nothing to remember with: the shelf opens Genesis 1.
  }
}

/**
 * Where the shelf opens an edition (locale-less): the chapter last read, or Genesis 1. The edition's index page
 * resolves `?book=&chapter=` to the chapter's address, or lists the books when the edition lacks it.
 */
export function resumeHref(sigla: string): string {
  const at = loadLastRead(sigla) ?? { bookNum: 1, chapter: 1 };
  return `/read/${editionSlug(sigla)}?book=${at.bookNum}&chapter=${at.chapter}`;
}
