import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { EditionFlagSwitch } from "@/components/EditionFlagSwitch";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getAccessToken } from "@/lib/access";
import { adminUrl, type AdminVersion } from "@/lib/admin";

type Listing = { versions: AdminVersion[] } | { error: "signIn" | "failed" };

async function listVersions(): Promise<Listing> {
  // In a Server Component an expired token is not refreshed (cookies cannot be written): ask to sign in again.
  const token = await getAccessToken();
  const url = adminUrl("/admin/versions");
  if (!token) return { error: "signIn" };
  if (!url) return { error: "failed" };
  try {
    const res = await fetch(url, { cache: "no-store", headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
    if (res.status === 401) return { error: "signIn" };
    if (!res.ok) return { error: "failed" };
    const body = (await res.json()) as { versions?: AdminVersion[] };
    return { versions: body.versions ?? [] };
  } catch {
    return { error: "failed" };
  }
}

export default async function AdminEditionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user || session.error || session.admin !== true) notFound();

  const t = await getTranslations("Admin");
  const listing = await listVersions();

  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <Link href="/" className="text-sm text-slate-600 underline dark:text-slate-400">
        {t("back")}
      </Link>
      <h1 className="mt-2 text-3xl font-semibold">{t("title")}</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-400">{t("intro")}</p>
      {"error" in listing ? (
        <p role="alert" className="mt-6 text-red-700 dark:text-red-400">
          {listing.error === "signIn" ? t("signInAgain") : t("listFailed")}
        </p>
      ) : (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-300 dark:border-slate-700">
              <th className="py-2">{t("edition")}</th>
              <th>{t("year")}</th>
              <th>{t("copyright")}</th>
              <th>{t("fullText")}</th>
              <th>{t("liturgical")}</th>
            </tr>
          </thead>
          <tbody>
            {listing.versions.map((v) => (
              <tr key={v.sigla} className="border-b border-slate-200 dark:border-slate-800">
                <td className="py-2">
                  <span className="font-medium">{v.sigla}</span> <span className="text-slate-600 dark:text-slate-400">{v.fullname}</span>
                </td>
                <td>{v.year}</td>
                <td>{v.copyright ? t("copyrighted") : t("publicDomain")}</td>
                <td>
                  <EditionFlagSwitch sigla={v.sigla} field="reader_full_text" initial={v.reader_full_text} />
                </td>
                <td>
                  {/* An endpoint that predates the flag omits it: shown off. */}
                  <EditionFlagSwitch sigla={v.sigla} field="liturgical" initial={v.liturgical === true} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
