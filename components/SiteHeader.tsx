import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/** The site header on every page: the BibleGet logo and name, linking home, and the sign-in state (`auth`). */
export function SiteHeader({ auth }: { auth: React.ReactNode }) {
  const t = useTranslations("Metadata");
  return (
    <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
      <Link href="/" className="flex items-center gap-2 font-semibold hover:underline">
        {/* Served as is from public/: no image optimizer needed for a 96 px logo shown at 32 px. */}
        <Image src="/bibleget-logo.png" alt="" width={32} height={32} unoptimized priority />
        {t("siteName")}
      </Link>
      {auth}
    </header>
  );
}
