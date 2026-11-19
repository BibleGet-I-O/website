import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocalePicker } from "@/components/LocalePicker";
import { NavMenu } from "@/components/NavMenu";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import type { Theme } from "@/lib/theme";

/**
 * The site header on every page: the BibleGet logo and name, linking home, then the menu: the language picker, the
 * theme switch and the sign-in state (`auth`), in a row from `sm` up and behind a hamburger button below it.
 */
export function SiteHeader({ auth, theme }: { auth: React.ReactNode; theme: Theme }) {
  const t = useTranslations("Metadata");
  return (
    <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
      <Link href="/" className="flex items-center gap-2 font-semibold hover:underline">
        {/* Served as is from public/: no image optimizer needed for a 96 px logo shown at 32 px. */}
        <Image src="/bibleget-logo.png" alt="" width={32} height={32} unoptimized priority />
        {t("siteName")}
      </Link>
      <NavMenu>
        <LocalePicker />
        <ThemeSwitch initial={theme} />
        {auth}
      </NavMenu>
    </header>
  );
}
