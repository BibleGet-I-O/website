import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFoundPage() {
  const t = await getTranslations("NotFound");
  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      <p className="mt-2">{t("body")}</p>
      <Link href="/" className="mt-4 inline-block underline">
        {t("home")}
      </Link>
    </main>
  );
}
