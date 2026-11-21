import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import ApiReference from "@/components/ApiReference";

async function titleFor(locale: Locale) {
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return `${t("apiReferenceTitle")} · ${t("siteName")}`;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: await titleFor(locale), description: t("apiReferenceDescription") };
}

/** The API reference: the endpoint's OpenAPI document in Scalar. */
export default async function ScalarPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <ApiReference locale={locale} title={await titleFor(locale)} />;
}
