import { WhyLink } from "@/components/WhyLink";

/** Beside a psalm's title, its place in the other count ("(23)", "(9–10)") and why there are two; nothing where they agree. */
export function PsalmNumber({ note }: { note: string | null }) {
  if (!note) return null;
  return (
    <span className="inline-flex items-center font-sans text-sm text-slate-500 dark:text-slate-400">
      {note}
      <WhyLink topic="psalm-numbering" />
    </span>
  );
}
