"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import styles from "@/components/book.module.css";
import { editionSlug } from "@/lib/slug";
import type { Edition } from "@/lib/types";

/** The back of the cover: an endpaper with the year, the rights and the edition's notes. */
function BackCover({ edition, name }: { edition: Edition; name: string }) {
  const t = useTranslations("Home");
  const lang = edition.language || undefined;
  const notes = edition.notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rights = edition.copyrightHolder || (edition.copyright ? "" : t("publicDomain"));
  return (
    // Long notes scroll: a focusable, named region lets keyboard users scroll it (Safari included).
    <div className={styles.endpaper} tabIndex={0} role="region" aria-label={t("colophon", { name })}>
      <p className={styles.backHeading} lang={lang}>
        {edition.fullname}
      </p>
      <dl className={styles.colophon}>
        {edition.year && (
          <>
            <dt>{t("year")}</dt>
            <dd>{edition.year}</dd>
          </>
        )}
        {rights && (
          <>
            <dt>{t("rights")}</dt>
            <dd>{rights}</dd>
          </>
        )}
        {notes.length > 0 && (
          <>
            <dt>{t("notes")}</dt>
            <dd lang={lang}>
              {notes.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}

/**
 * One edition as a tooled-leather book: the cover opens the edition, and the © button beside the sigla turns
 * the book round to show its colophon on the back cover. Copyrighted editions get the darker binding; a
 * liturgical text carries a small gilt "Liturgical text" stamp at the foot of the cover (part of the link's name).
 */
export default function BookCover({ edition }: { edition: Edition }) {
  const t = useTranslations("Home");
  const [turned, setTurned] = useState(false);
  const backId = useId();
  const name = edition.year ? t("bookName", { name: edition.fullname, year: edition.year }) : edition.fullname;
  const tone = edition.copyright ? "dark" : "bright";
  const lang = edition.language || undefined;
  return (
    <div className={styles.slot}>
      {/* First in the DOM (shown below the book by CSS order) so that, once turned, Tab reaches the back cover. */}
      <span className={styles.labelRow}>
        <span className={styles.label}>{edition.sigla}</span>
        <button
          type="button"
          className={styles.about}
          aria-label={t("aboutNamed", { name })}
          aria-expanded={turned}
          aria-controls={backId}
          onClick={() => setTurned((v) => !v)}
        >
          ©
        </button>
      </span>
      <div className={`${styles.turner} ${turned ? styles.turned : ""}`}>
        <div className={styles.front} inert={turned}>
          <Link href={`/read/${editionSlug(edition.sigla)}`} className={`${styles.book} ${styles[tone]}`} data-tone={tone}>
            <span className={styles.frame} aria-hidden />
            <span className={styles.sigla} aria-hidden>
              {edition.sigla}
            </span>
            <span className={styles.title} lang={lang}>
              {edition.fullname}
            </span>
            {edition.year && (
              <>
                <span className="sr-only">,</span>{" "}
                <span className={styles.year}>{edition.year}</span>
              </>
            )}
            {edition.liturgical && (
              <>
                <span className="sr-only">,</span>{" "}
                <span className={styles.liturgical} data-marker="liturgical">
                  {t("liturgical")}
                </span>
              </>
            )}
          </Link>
        </div>
        <div id={backId} className={`${styles.back} ${styles[tone]}`} data-tone={tone} inert={!turned}>
          <BackCover edition={edition} name={name} />
        </div>
      </div>
    </div>
  );
}
