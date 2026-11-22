import { Fragment, type ReactNode } from "react";
import type { SearchHit } from "@/lib/search";

/** Lowercased and without accents, so "Israël" and "israel" compare equal. */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();

/** The text with the searched words in <mark>: whole words (letters and digits), compared without case or accents. */
export function markWords(text: string, words: string[]): ReactNode {
  const wanted = new Set(words.map(fold).filter((w) => w.length > 0));
  if (wanted.size === 0) return text;
  return text.split(/([\p{L}\p{N}]+)/u).map((part, i) =>
    i % 2 === 1 && wanted.has(fold(part)) ? <mark key={i} className={markClass}>{part}</mark> : <Fragment key={i}>{part}</Fragment>,
  );
}

const WORD = /([\p{L}\p{N}]+)/u;
/** A gap between words, compared as the endpoint's exact match does: without case or accents, spaces collapsed. */
const gap = (s: string) => fold(s).replace(/\s+/g, " ");
const markClass = "bg-amber-200 dark:bg-amber-700 dark:text-white";

/**
 * The text with each occurrence of the phrase in <mark>: the phrase's words in a row, as whole words, compared
 * without case or accents, with the same gaps between them ("pastor de ovejas" marks that phrase, not every "de").
 * This is what an exact keyword search matched.
 */
export function markPhrase(text: string, phrase: string): ReactNode {
  // Words at the odd indices, the gaps around them at the even ones.
  const want = phrase.trim().split(WORD).slice(1, -1);
  if (want.length === 0) return text;
  const parts = text.split(WORD);
  const out: ReactNode[] = [];
  let plain = "";
  for (let i = 0; i < parts.length; ) {
    const hit = i % 2 === 1 && i + want.length <= parts.length
      && want.every((w, k) => (k % 2 === 0 ? fold(parts[i + k]) === fold(w) : gap(parts[i + k]) === gap(w)));
    if (!hit) {
      plain += parts[i];
      i += 1;
      continue;
    }
    if (plain) out.push(<Fragment key={out.length}>{plain}</Fragment>);
    plain = "";
    out.push(<mark key={out.length} className={markClass}>{parts.slice(i, i + want.length).join("")}</mark>);
    i += want.length;
  }
  if (plain) out.push(<Fragment key={out.length}>{plain}</Fragment>);
  return out;
}

/** chapter:verse as the edition prints it: its own label when it has one ("12:1", "17a"), else verse and letter. */
export function reference(h: SearchHit): string {
  if (h.label) return h.label.includes(":") ? h.label : `${h.chapter}:${h.label}`;
  return `${h.chapter}:${h.verse}${h.segment ?? ""}`;
}

/** The words of a keyword search, for marking them in the results. */
export const queryWords = (q: string) => q.match(/[\p{L}\p{N}]+/gu) ?? [];

/**
 * The hits of a search, each with its reference (linking to the verse on its chapter's page, as the edition prints
 * it) and its text. `hrefFor` builds a hit's link; `mark` the words to emphasise (keyword search only), or
 * `phrase` the phrase an exact search matched, marked as a whole instead.
 */
export function SearchResults({ hits, start, hrefFor, bookName, mark, phrase }: {
  hits: SearchHit[];
  start: number;
  hrefFor: (h: SearchHit) => string;
  bookName: (h: SearchHit) => string;
  mark: string[];
  phrase?: string;
}) {
  return (
    <ol start={start} className="space-y-4">
      {hits.map((h, i) => (
        <li key={`${h.bookNum}-${h.chapter}-${h.verse}-${h.segment ?? ""}-${i}`}>
          {/* A plain link, not a client-side one: the browser then scrolls to the verse and marks it (:target). */}
          <a href={hrefFor(h)} className="font-semibold text-red-700 hover:underline dark:text-red-400">
            {`${bookName(h)} ${reference(h)}`}
          </a>
          <p className="font-serif text-lg leading-relaxed">{phrase !== undefined ? markPhrase(h.text, phrase) : markWords(h.text, mark)}</p>
        </li>
      ))}
    </ol>
  );
}

