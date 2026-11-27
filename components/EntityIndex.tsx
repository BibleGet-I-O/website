import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { byLetter, compactRefs, description, displayName, otherName, showsWikidata, type Entity, type EntityType } from "@/lib/entities";
import type { Book } from "@/lib/types";

/** More verses than this, and an entry's list folds behind its books and count. */
const FOLD_AFTER = 40;

const HEADING = { person: "personsIn", place: "placesIn", event: "eventsIn" } as const;

export type EntityIndexProps = {
  editionName: string;
  sigla: string;
  /** The edition's language: which of CBPPEDR's names is shown (lib/entities displayName). */
  editionLang: string;
  type: EntityType;
  entities: Entity[];
  books: Book[];
  /** The letter asked for (`?letter=`); the first letter with entries when absent or empty. */
  letter: string | null;
  locale: string;
  /** The reader page the index was opened from, already checked; every letter link keeps it. */
  back: string | null;
};

/**
 * An edition's index of the persons, places or events of CBPPEDR, as a printed Bible's index of names: a letter bar,
 * then the letter's entries, each with its name in the edition's language (and in the reader's, where it differs),
 * CBPPEDR's description, an "uncertain" mark, a Wikidata link where the item was reviewed, and its verses linked into
 * the reader. A long list of verses folds behind its books and count.
 */
export function EntityIndex(p: EntityIndexProps) {
  const t = useTranslations("Reader.indices");
  const letters = byLetter(p.entities, p.editionLang);
  const current = p.letter && letters.has(p.letter) ? p.letter : ([...letters.keys()][0] ?? null);
  const keep = p.back ? `&back=${encodeURIComponent(p.back)}` : "";
  return (
    <article className="mx-auto max-w-3xl">
      {p.back && (
        <a href={p.back} className="font-sans text-sm text-slate-600 underline hover:text-red-700 dark:text-slate-400 dark:hover:text-red-400">
          {t("back")}
        </a>
      )}
      <h1 className="mt-2 font-serif text-2xl font-semibold">{t(HEADING[p.type], { edition: p.editionName })}</h1>
      <p className="mt-1 font-sans text-sm text-slate-600 dark:text-slate-400">{t("about")}</p>
      {current === null ? (
        <p className="mt-6">{t("empty")}</p>
      ) : (
        <>
          <nav aria-label={t("letters")} className="mt-4 flex flex-wrap gap-1 font-sans">
            {[...letters.keys()].map((l) => (
              <a
                key={l}
                href={`?letter=${l}${keep}`}
                aria-current={l === current ? "page" : undefined}
                className={`rounded px-2 py-1 ${l === current ? "bg-red-700 text-white dark:bg-red-400 dark:text-slate-950" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
              >
                {l}
              </a>
            ))}
          </nav>
          <ul className="mt-6 space-y-4">
            {letters.get(current)!.map((e) => (
              <Item key={e.id} e={e} {...p} />
            ))}
          </ul>
        </>
      )}
    </article>
  );
}

function Item({ e, ...p }: { e: Entity } & EntityIndexProps) {
  const t = useTranslations("Reader.indices");
  const other = otherName(e, p.editionLang, p.locale);
  const about = description(e, p.locale);
  const groups = compactRefs(e.refs, p.books, p.sigla);
  const verses = (
    <span className="font-sans text-sm">
      {groups.map((g, i) => (
        <span key={i}>
          {i > 0 && "; "}
          {g.book}{" "}
          {g.parts.map((part, j) => (
            <span key={j}>
              {j > 0 && ", "}
              <Link href={part.href} className="text-red-700 hover:underline dark:text-red-400">{part.label}</Link>
            </span>
          ))}
        </span>
      ))}
    </span>
  );
  return (
    <li>
      <p>
        <span lang={p.editionLang} className="font-serif text-lg font-semibold">{displayName(e, p.editionLang)}</span>
        {other && <span className="ml-1 text-slate-600 dark:text-slate-400">({other})</span>}
        {e.uncertain && (
          <span title={t("uncertainTitle")} className="ml-2 rounded border border-amber-600 px-1 font-sans text-xs text-amber-700 dark:border-amber-400 dark:text-amber-300">
            {t("uncertain")}
          </span>
        )}
        {showsWikidata(e) && (
          <a href={`https://www.wikidata.org/wiki/${e.qid}`} target="_blank" rel="noopener noreferrer" className="ml-2 font-sans text-xs text-slate-500 underline dark:text-slate-400">
            {t("wikidata")}
          </a>
        )}
      </p>
      {about && <p className="text-slate-700 dark:text-slate-300">{about}</p>}
      {e.refs.length > FOLD_AFTER ? (
        <details>
          <summary className="cursor-pointer font-sans text-sm">
            {groups.map((g) => g.book).join(", ")} · {t("verses", { count: e.refs.length })}
          </summary>
          {verses}
        </details>
      ) : (
        verses
      )}
    </li>
  );
}
