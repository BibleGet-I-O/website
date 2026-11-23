/** Who a speaker tag names: NABRE's letters (Song of Songs) and the Clementine Vulgate's Latin rubrics. */
export type SpeakerKey = "woman" | "man" | "daughters" | "bride" | "bridegroom" | "chorus" | "brothers" | "maidens";

const SPEAKERS: Record<string, SpeakerKey> = {
  W: "woman",
  M: "man",
  D: "daughters",
  Sponsa: "bride",
  Sponsus: "bridegroom",
  Chorus: "chorus",
  "Chorus Fratrum": "brothers",
  "Chorus Adolescentularum": "maidens",
};

/** The speaker a tag names; a trailing `?` (NABRE: "D?") marks an uncertain attribution. Null for an unknown tag. */
export function speakerOf(tag: string): { who: SpeakerKey; uncertain: boolean } | null {
  const uncertain = tag.endsWith("?");
  const who = SPEAKERS[uncertain ? tag.slice(0, -1) : tag];
  return who ? { who, uncertain } : null;
}
