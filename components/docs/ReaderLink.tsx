import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { compareQuery, type View } from "@/lib/compare";
import { editionSlug } from "@/lib/slug";

type ReaderPlace = { edition: string; book: number; chapter: number; verse?: number; with?: string[]; view?: View; tradition?: "GREEK" | "HEBREW" };

/**
 * A place in the reader, by universal book number: the edition's books page (`/read/{edition}?book=&chapter=`) redirects to
 * the chapter under the edition's own book slug, keeping the comparison, so a renamed book never breaks a docs link.
 */
export function readerHref({ edition, book, chapter, verse, with: others = [], view = "side-by-side", tradition }: ReaderPlace): string {
  const compare = compareQuery({ with: others, view, tradition });
  const query = `?book=${book}&chapter=${chapter}${compare ? `&${compare.slice(1)}` : ""}`;
  return `/read/${editionSlug(edition)}${query}${verse ? `#v${chapter}.${verse}` : ""}`;
}

/** <ReaderLink edition="NABRE" book={27} chapter={11} verse={26}>Wisdom 11:26</ReaderLink>: the same edition in every language. */
export function ReaderLink({ children, ...place }: ReaderPlace & { children?: ReactNode }) {
  return <Link href={readerHref(place)}>{children}</Link>;
}
