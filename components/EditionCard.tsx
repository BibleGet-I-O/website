import { Link } from "@/i18n/navigation";
import type { Edition } from "@/lib/types";

/** The lowercase path segment for an edition: /read/drb. */
export const editionSlug = (sigla: string) => sigla.toLowerCase();

export function EditionCard({ edition }: { edition: Edition }) {
  const meta = [edition.year, edition.copyrightHolder].filter(Boolean).join(" · ");
  return (
    <Link
      href={`/read/${editionSlug(edition.sigla)}`}
      className="block rounded-lg border border-slate-200 p-4 hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
    >
      <span className="block font-medium">
        {edition.fullname} <span className="text-sm font-normal text-slate-500">({edition.sigla})</span>
      </span>
      {meta && <span className="mt-1 block text-sm text-slate-600 dark:text-slate-400">{meta}</span>}
    </Link>
  );
}
