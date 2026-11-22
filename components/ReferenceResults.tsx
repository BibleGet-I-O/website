import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { VerseLines } from "@/components/VerseLines";
import type { PassageGroup } from "@/lib/passage";

/** A reference search's verses as a passage: a heading per book and chapter, linking to it in the reader. */
export async function ReferenceResults({ groups, hrefFor, bookName, lang }: { groups: PassageGroup[]; hrefFor: (g: PassageGroup) => string; bookName: (bookNum: number) => string; lang?: string }) {
  const t = await getTranslations("Search");
  return (
    <div className="space-y-6">
      {groups.map((g, i) => (
        // A reference can come back to the same place (Jonah 1:1; John 1:1; Jonah 1:1): its position keeps each apart.
        <section key={`${i}:${g.bookNum}:${g.chapter}`}>
          <h2 className="mb-2 text-xl font-semibold">
            <Link href={hrefFor(g)} className="hover:underline">{t("passageHeading", { book: bookName(g.bookNum), chapter: g.chapter })}</Link>
          </h2>
          <VerseLines rows={g.rows} chapter={g.chapter} lang={lang} />
        </section>
      ))}
    </div>
  );
}
