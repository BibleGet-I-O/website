"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { description, displayName, indexEntryHref, otherName } from "@/lib/entity-names";
import type { MentionEntity } from "@/lib/types";

/** What a mark names: one settled entry, or the candidates of a mention under review. */
export type MarkTarget = { entry?: string; candidates?: string[] };

export type MentionCardProps = {
  mark: MarkTarget;
  entities: Record<string, MentionEntity>;
  /** The edition's sigla, for the index link. */
  sigla: string;
  /** The edition's language: which of CBPPEDR's names is shown (lib/entities displayName). */
  editionLang: string;
  /** The interface language. */
  locale: string;
};

/** The entities a mark names that the quote sent, in order. */
export function markEntities(mark: MarkTarget, entities: Record<string, MentionEntity>): MentionEntity[] {
  const ids = mark.entry !== undefined ? [mark.entry] : (mark.candidates ?? []);
  return ids.flatMap((id) => entities[id] ?? []);
}

/** The card's accessible name: the displayed names of what the mark names (each once). */
export function cardLabel(mark: MarkTarget, entities: Record<string, MentionEntity>, editionLang: string): string {
  return [...new Set(markEntities(mark, entities).map((e) => displayName(e, editionLang)))].join(" / ");
}

const commonsName = (file: string) => encodeURIComponent(file.replace(/ /g, "_"));
const isWeb = (url: string) => /^https?:\/\//i.test(url);

/**
 * A mark's card: the entity's name (in the edition's language, the interface language's in brackets where it differs,
 * as the index), its description, the "uncertain" mark, its Commons image with author and licence, its Wikipedia
 * article and a link to its entry on the index. A mention under review opens with the review line, then a section per
 * candidate (two columns where the card has room).
 */
export function MentionCard({ mark, entities, ...p }: MentionCardProps) {
  const t = useTranslations("Reader.mentions");
  const shown = markEntities(mark, entities);
  const review = mark.entry === undefined;
  return (
    <>
      {review && (
        <p className="mb-2 flex items-center gap-1.5 font-sans text-sm font-semibold text-red-700 dark:text-red-400">
          <span aria-hidden className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-700 text-[0.65rem] text-white dark:bg-red-400 dark:text-slate-950">?</span>
          {t("underReview")}
        </p>
      )}
      <div className={shown.length > 1 ? "grid gap-3 sm:grid-cols-2 sm:divide-x sm:divide-slate-200 dark:sm:divide-slate-700" : ""}>
        {shown.map((e, i) => (
          <div key={e.id} className={i > 0 ? "border-t border-slate-200 pt-3 sm:border-t-0 sm:pl-3 sm:pt-0 dark:border-slate-700" : ""}>
            <EntitySection e={e} {...p} />
          </div>
        ))}
      </div>
    </>
  );
}

function EntitySection({ e, sigla, editionLang, locale }: { e: MentionEntity } & Omit<MentionCardProps, "mark" | "entities">) {
  const t = useTranslations("Reader.mentions");
  const name = displayName(e, editionLang);
  const other = otherName(e, editionLang, locale);
  const about = description(e, locale);
  const wikiLang = e.wikipedia?.[locale] ? locale : e.wikipedia?.en ? "en" : null;
  const wiki = wikiLang ? `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(e.wikipedia![wikiLang].replace(/ /g, "_"))}` : null;
  const linkClass = "text-red-700 underline-offset-2 hover:underline dark:text-red-400";
  return (
    <section>
      <p>
        <span lang={editionLang} className="font-serif text-base font-semibold">{name}</span>
        {other && <span className="ml-1 text-slate-600 dark:text-slate-400">({other})</span>}
        {e.uncertain && (
          <span title={t("uncertainTitle")} className="ml-2 rounded border border-amber-600 px-1 font-sans text-xs text-amber-700 dark:border-amber-400 dark:text-amber-300">
            {t("uncertain")}
          </span>
        )}
      </p>
      {about && <p className="mt-0.5 text-slate-700 dark:text-slate-300">{about}</p>}
      {e.image && (
        <figure className="mt-2">
          <a href={`https://commons.wikimedia.org/wiki/File:${commonsName(e.image.file)}`} target="_blank" rel="noopener noreferrer" className="inline-block">
            {/* A Commons thumbnail: served at the width asked for, nothing for next/image to optimise. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://commons.wikimedia.org/wiki/Special:FilePath/${commonsName(e.image.file)}?width=160`}
              alt={t("imageAlt", { name })}
              width={160}
              loading="lazy"
              className="max-h-48 w-40 rounded object-contain"
            />
          </a>
          <figcaption className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span>{t("imageCredit", { author: e.image.author })}</span>
            {" · "}
            {isWeb(e.image.licenseUrl) ? (
              <a href={e.image.licenseUrl} target="_blank" rel="noopener noreferrer license" className="underline">{e.image.license}</a>
            ) : (
              e.image.license
            )}
          </figcaption>
        </figure>
      )}
      {/* A place's map goes here (Task 15). */}
      {(e.verseCount > 0 || wiki) && (
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {e.verseCount > 0 && (
            <Link href={indexEntryHref(e, e.type, sigla, editionLang)} className={linkClass}>{t("allVerses", { count: e.verseCount })}</Link>
          )}
          {wiki && (
            <a href={wiki} hrefLang={wikiLang!} target="_blank" rel="noopener noreferrer" className={linkClass}>{t("wikipedia")}</a>
          )}
        </p>
      )}
    </section>
  );
}
