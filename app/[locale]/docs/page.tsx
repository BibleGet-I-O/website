import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { UntranslatedNotice } from "@/components/docs/UntranslatedNotice";
import { docsComponents } from "@/components/docs/mdx";
import styles from "@/components/docs/docs.module.css";
import { docContent } from "@/lib/doc-content";
import { DOC_PAGES, DOC_PARTS, INDEX_LANGS, docContentLang, docHref } from "@/lib/docs";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Docs" });
  return { title: t("index.title"), description: t("index.description") };
}

/** The docs index: its introduction, then each part with its pages' titles and descriptions in the interface language. */
export default async function DocsIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Docs" });
  const lang = docContentLang(INDEX_LANGS, locale);
  const Intro = await docContent(lang, "index");
  return (
    <>
      {lang !== locale && <UntranslatedNotice />}
      <article lang={lang} className={styles.article}>
        <Intro components={docsComponents} />
      </article>
      <div className={styles.article}>
        {DOC_PARTS.map((part) => (
          <section key={part}>
            <h2>{t(`parts.${part}`)}</h2>
            <ul>
              {DOC_PAGES.filter((p) => p.part === part).map((p) => (
                <li key={p.slug}>
                  <Link href={docHref(p.slug)}>{t(`pages.${p.slug}.title`)}</Link> — {t(`pages.${p.slug}.description`)}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
