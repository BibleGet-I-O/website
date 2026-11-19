import { createNavigation } from "next-intl/navigation";
import { routing } from "@/i18n/routing";

/** Locale-keeping navigation: hrefs are locale-less ("/read"); the current locale is prefixed. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
