import { WhyLink } from "@/components/WhyLink";
import { psalmNote } from "@/lib/why";

/** Beside a psalm's title, its number in the other count ("(23)", "(9–10)") and why there are two; nothing where they agree. */
export function PsalmNumber({ numbers }: { numbers: number[] }) {
  if (numbers.length === 0) return null;
  return (
    <span className="inline-flex items-center font-sans text-sm text-slate-500 dark:text-slate-400">
      {psalmNote(numbers)}
      <WhyLink topic="psalm-numbering" />
    </span>
  );
}
