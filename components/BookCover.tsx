"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import styles from "@/components/book.module.css";
import { editionSlug } from "@/components/EditionCard";
import type { Edition } from "@/lib/types";

/** The back of the cover: an endpaper with the year, the rights and the edition's notes. */
function BackCover({ edition }: { edition: Edition }) {
  const t = useTranslations("Home");
  const notes = edition.notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rights = edition.copyrightHolder || (edition.copyright ? "" : t("publicDomain"));
  return (
    <div className={styles.endpaper}>
      <p className={styles.backHeading}>{edition.fullname}</p>
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
            <dd>
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
 * the book round to show its colophon on the back cover. Copyrighted editions get the darker binding.
 */
export default function BookCover({ edition }: { edition: Edition }) {
  const t = useTranslations("Home");
  const [turned, setTurned] = useState(false);
  const backId = useId();
  const name = edition.year ? t("bookName", { name: edition.fullname, year: edition.year }) : edition.fullname;
  const tone = edition.copyright ? styles.dark : styles.bright;
  return (
    <div className={styles.slot}>
      <div className={`${styles.turner} ${turned ? styles.turned : ""}`}>
        <div className={styles.front} inert={turned}>
          <Link href={`/read/${editionSlug(edition.sigla)}`} className={`${styles.book} ${tone}`} aria-label={name}>
            <span className={styles.frame} aria-hidden />
            <span className={styles.sigla} aria-hidden>
              {edition.sigla}
            </span>
            <span className={styles.title} aria-hidden>
              {edition.fullname}
            </span>
            {edition.year && (
              <span className={styles.year} aria-hidden>
                {edition.year}
              </span>
            )}
          </Link>
        </div>
        <section id={backId} className={`${styles.back} ${tone}`} aria-label={t("colophon", { name })} inert={!turned}>
          <BackCover edition={edition} />
        </section>
      </div>
      <span className={styles.labelRow}>
        <span className={styles.label}>{edition.sigla}</span>
        <button
          type="button"
          className={styles.about}
          aria-label={t("aboutNamed", { name })}
          aria-expanded={turned}
          aria-controls={backId}
          title={t("aboutEdition")}
          onClick={() => setTurned((v) => !v)}
        >
          ©
        </button>
      </span>
    </div>
  );
}
