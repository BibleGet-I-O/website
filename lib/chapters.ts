import type { Book } from "@/lib/types";

/**
 * A book's chapters as the reader lists them. A book whose edition prints a prologue before chapter 1 (Sirach's
 * foreword, endpoint migration 065) has it as chapter 0: one verse, its heading in `title1`.
 */
type Chapters = Pick<Book, "chapters" | "versesPerChapter" | "greekVersesPerChapter" | "prologue">;

export const PROLOGUE = 0;

export function firstChapter(b: Pick<Book, "chapters" | "prologue">): number {
  return (b.prologue ?? 0) > 0 ? PROLOGUE : 1;
}

export function chapterNumbers(b: Pick<Book, "chapters" | "prologue">): number[] {
  const first = firstChapter(b);
  return Array.from({ length: b.chapters - first + 1 }, (_, i) => first + i);
}

export function hasChapter(b: Pick<Book, "chapters" | "prologue">, chapter: number): boolean {
  return Number.isInteger(chapter) && chapter >= firstChapter(b) && chapter <= b.chapters;
}

/** The chapter's verse count (Esther with both texts: the Greek unless the Hebrew is asked for); undefined when the book lacks it. */
export function versesIn(b: Chapters, chapter: number, tradition?: string): number | undefined {
  if (!hasChapter(b, chapter)) return undefined;
  if (chapter === PROLOGUE) return b.prologue;
  const counts = b.greekVersesPerChapter && tradition !== "HEBREW" ? b.greekVersesPerChapter : b.versesPerChapter;
  return counts[chapter - 1];
}
