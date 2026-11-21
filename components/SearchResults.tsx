import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import type { SearchHit } from "@/lib/search";

/** Lowercased and without accents, so "Israël" and "israel" compare equal. */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();

/** The text with the searched words in <mark>: whole words, compared without case or accents. */
export function markWords(text: string, words: string[]): ReactNode {
  const wanted = new Set(words.map(fold).filter((w) => w.length > 0));
  if (wanted.size === 0) return text;
  return text.split(/(\p{L}+)/u).map((part, i) =>
    i % 2 === 1 && wanted.has(fold(part)) ? <mark key={i} className="bg-amber-200 dark:bg-amber-700 dark:text-white">{part}</mark> : <Fragment key={i}>{part}</Fragment>,
  );
}

/** The words of a keyword search, for marking them in the results. */
export const queryWords = (q: string) => q.match(/\p{L}+/gu) ?? [];

/**
 * The hits of a search, each with its reference (linking to the verse on its chapter's page, as the edition prints
 * it) and its text. `hrefFor` builds a hit's link; `mark` the words to emphasise (keyword search only).
 */
export function SearchResults({ hits, start, hrefFor, bookName, mark }: {
  hits: SearchHit[];
  start: number;
  hrefFor: (h: SearchHit) => string;
  bookName: (h: SearchHit) => string;
  mark: string[];
}) {
  return (
    <ol start={start} className="space-y-4">
      {hits.map((h, i) => (
        <li key={`${h.bookNum}-${h.chapter}-${h.verse}-${h.segment ?? ""}-${i}`}>
          <Link href={hrefFor(h)} className="font-semibold text-red-700 hover:underline dark:text-red-400">
            {`${bookName(h)} ${h.chapter}:${h.verse}${h.segment ?? ""}`}
          </Link>
          <p className="font-serif text-lg leading-relaxed">{markWords(h.text, mark)}</p>
        </li>
      ))}
    </ol>
  );
}

