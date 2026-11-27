import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { AcceptChapterButton } from "@/components/AcceptChapterButton";
import { ReviewLink, type ShownUnit } from "@/components/ReviewLink";
import { SignInButton } from "@/components/SignInButton";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getAccess } from "@/lib/access";
import { getChapter, getEditions, getIndex } from "@/lib/api";
import { plainText, reviewGet, unitChapterVerse, unitVerse, type ReviewChapter } from "@/lib/review";
import { editionSlug } from "@/lib/slug";
import type { VerseRow } from "@/lib/types";

/** The Nova Vulgata: the units' text comes from it. */
const NOVA_VULGATA = "NVBSE";

type Params = { locale: string; edition: string; book: string; chapter: string };

/**
 * Verse texts by "chapter:verse[letter][@TRADITION]": a lettered verse is a verse of its own (Esther 1:1a is not
 * 1:1); the unlettered parts of a verse printed in several rows are joined.
 */
function texts(rows: VerseRow[], tradition = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of rows) {
    const k = `${r.chapter}:${r.verse}${r.segment ?? ""}${tradition ? `@${tradition}` : ""}`;
    out.set(k, [out.get(k), plainText(r.text)].filter(Boolean).join(" "));
  }
  return out;
}

/** The key a link's ref finds its text under: its part number dropped ("10:1#2" -> "10:1"), its letter kept. */
function textKey(ref: string): string {
  return ref.replace(/#\d+/, "");
}

async function chapterTexts(
  sigla: string,
  bookNum: number,
  chapters: number[],
  access: "visitor" | "reader",
  traditions: string[] = [""],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const book = (await getIndex(sigla)).books.find((b) => b.bookNum === bookNum);
    if (!book) return out;
    for (const c of chapters) {
      for (const tradition of traditions) {
        try {
          const rows = (await getChapter({ sigla, bookAbbrev: book.abbrev, chapter: c, access, mentions: false, ...(tradition && { tradition }) })).rows;
          for (const [k, v] of texts(rows, tradition)) out.set(k, v);
        } catch {
          // A chapter that cannot be fetched leaves its texts empty; the links still show.
        }
      }
    }
  } catch {
    // No index: no texts.
  }
  return out;
}

/**
 * One chapter's links to review: each of the edition's verses beside the Nova Vulgata text of its units, the
 * link's confidence, and the reviewer's actions; then "accept the chapter's remaining drafts".
 */
export default async function ChapterReviewPage({ params }: { params: Promise<Params> }) {
  const { locale, edition: slug, book: bookParam, chapter: chapterParam } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user || session.error || session.reviewer !== true) notFound();
  if (!/^[1-9]\d?$/.test(bookParam) || !/^[1-9]\d{0,2}$/.test(chapterParam)) notFound();
  const edition = (await getEditions()).find((e) => editionSlug(e.sigla) === slug.toLowerCase());
  if (!edition) notFound();
  const bookNum = Number(bookParam);
  const chapter = Number(chapterParam);

  const t = await getTranslations("Review");
  const fetched = await reviewGet<ReviewChapter>(`/editions/${edition.sigla}/books/${bookNum}/chapters/${chapter}`);
  if ("error" in fetched && fetched.error === "notFound") notFound();
  const { access } = await getAccess();
  const data = "data" in fetched ? fetched.data : { links: [], units: [] };

  const traditions = [...new Set(data.links.map((l) => l.ref.split("@")[1] ?? ""))];
  const edTexts = await chapterTexts(edition.sigla, bookNum, [chapter], access, traditions);
  const unitIds = new Set([...data.links.flatMap((l) => l.units), ...data.units.map((u) => u.id)]);
  const nvChapters = [...new Set([...unitIds].map((id) => unitChapterVerse(id)?.[0]).filter((c): c is number => c !== undefined))].sort((a, b) => a - b);
  const nvTexts = await chapterTexts(NOVA_VULGATA, bookNum, nvChapters, access);
  const shown = (id: string): ShownUnit => {
    const ref = unitVerse(id) ?? id;
    return { id, ref, text: nvTexts.get(ref) ?? "" };
  };
  let bookName = String(bookNum);
  try {
    bookName = (await getIndex(edition.sigla)).books.find((b) => b.bookNum === bookNum)?.name ?? bookName;
  } catch {
    // The number stands in for the name.
  }

  return (
    <main className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <Link href={`/review?edition=${editionSlug(edition.sigla)}`} className="text-sm text-slate-600 underline dark:text-slate-400">{t("backToList")}</Link>
      <h1 className="mt-2 text-3xl font-semibold">{t("chapterTitle", { edition: edition.fullname, name: `${bookName} ${chapter}` })}</h1>
      {"error" in fetched ? (
        <div role="alert" className="mt-6 text-red-700 dark:text-red-400">
          <p>{fetched.error === "signIn" ? t("signInAgain") : t("listFailed")}</p>
          {fetched.error === "signIn" && <div className="mt-2">{await SignInButton({ redirectTo: `/${locale}/review/${slug}/${bookNum}/${chapter}` })}</div>}
        </div>
      ) : (
        <>
          {access === "visitor" && (
            <p role="note" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950">
              {t("capped")}
            </p>
          )}
          <div className="mt-6">
            {data.links.map((l) => {
              return (
                <ReviewLink
                  key={l.id}
                  link={l}
                  text={edTexts.get(textKey(l.ref)) ?? ""}
                  units={l.units.map(shown)}
                  stretch={data.units.filter((u) => u.stretch === l.stretch).map((u) => shown(u.id))}
                />
              );
            })}
          </div>
          {data.links.some((l) => l.status !== "rule") && (
            <AcceptChapterButton edition={edition.sigla} book={bookNum} chapter={chapter} drafts={data.links.filter((l) => l.status === "draft" && !l.note).length} />
          )}
        </>
      )}
    </main>
  );
}
