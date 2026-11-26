import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { DocsPager } from "@/components/docs/DocsPager";
import { UntranslatedNotice } from "@/components/docs/UntranslatedNotice";
import { docsComponents } from "@/components/docs/mdx";
import styles from "@/components/docs/docs.module.css";
import { docContent } from "@/lib/doc-content";
import { DOC_PAGES, docContentLang, findPage } from "@/lib/docs";

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => DOC_PAGES.map((p) => ({ locale, page: p.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; page: string }> }): Promise<Metadata> {
  const { locale, page } = await params;
  const p = findPage(page);
  if (!p) return {};
  const t = await getTranslations({ locale: locale as Locale, namespace: "Docs" });
  return { title: t(`pages.${p.slug}.title`), description: t(`pages.${p.slug}.description`) };
}

/** A docs page in the interface language where it is written in it; else the English, under a notice, marked lang="en". */
export default async function DocPage({ params }: { params: Promise<{ locale: string; page: string }> }) {
  const { locale: l, page } = await params;
  const locale = l as Locale;
  setRequestLocale(locale);
  const p = findPage(page);
  if (!p) notFound();
  const lang = docContentLang(p.langs, locale);
  const Content = await docContent(lang, p.slug);
  return (
    <>
      {lang !== locale && <UntranslatedNotice />}
      <article lang={lang} className={styles.article}>
        <Content components={docsComponents} />
      </article>
      <DocsPager slug={p.slug} />
    </>
  );
}
