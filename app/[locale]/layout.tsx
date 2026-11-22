import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import "../globals.css";
import { routing } from "@/i18n/routing";
import { AuthStatus } from "@/components/AuthStatus";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("siteName"), description: t("siteDescription") };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  // The reader's theme, rendered on the server so the page never flashes the other one; none = the system's.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang={locale} data-theme={theme === "system" ? undefined : theme}>
      <body className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <NextIntlClientProvider>
          <SiteHeader auth={<AuthStatus />} />
          {children}
          {/* Streamed: a slow endpoint must not hold back the page. */}
          <Suspense fallback={null}>
            <SiteFooter />
          </Suspense>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
