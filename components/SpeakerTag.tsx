"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { speakerOf } from "@/lib/speakers";

/**
 * A speaker tag printed in the text ("W", "D?", "Sponsa"): a button whose popover (opened natively, with no script)
 * says who speaks, and whose tooltip says it on hover. An unknown tag stays a plain label.
 */
export function SpeakerTag({ tag }: { tag: string }) {
  const s = speakerOf(tag);
  return s ? <KnownSpeaker tag={tag} speaker={s} /> : <span className="bg-speaker">{tag}</span>;
}

function KnownSpeaker({ tag, speaker: s }: { tag: string; speaker: NonNullable<ReturnType<typeof speakerOf>> }) {
  const t = useTranslations("Speakers");
  const id = useId();
  const who = t(`who.${s.who}`);
  const meaning = s.uncertain ? t("uncertain", { who }) : t("certain", { who });
  return (
    <>
      <button type="button" className="bg-speaker" popoverTarget={id} title={meaning} aria-label={`${tag}: ${meaning}`}>
        {tag}
      </button>
      <span popover="auto" id={id} role="tooltip" className="bg-speaker-pop">
        {meaning}
      </span>
    </>
  );
}
