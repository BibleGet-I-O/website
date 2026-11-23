"use client";

import { useEffect } from "react";
import { saveLastRead } from "@/lib/last-read";

/** Remembers, in this browser, the chapter being read in an edition: the shelf reopens it. Renders nothing. */
export function RememberChapter({ sigla, bookNum, chapter }: { sigla: string; bookNum: number; chapter: number }) {
  useEffect(() => {
    saveLastRead(sigla, { bookNum, chapter });
  }, [sigla, bookNum, chapter]);
  return null;
}
