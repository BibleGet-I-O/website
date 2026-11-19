"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { reviewLink, type ReviewChange } from "@/app/[locale]/review/actions";
import type { ReviewLinkData } from "@/lib/review";

/** A unit as the row shows it: its id, the Nova Vulgata reference it began as, and that verse's text. */
export type ShownUnit = { id: string; ref: string; text: string };

export type ReviewLinkProps = {
  link: ReviewLinkData;
  /** The edition's text of the verse. */
  text: string;
  /** The units the verse is linked to. */
  units: ShownUnit[];
  /** The units of the link's stretch: the only ones a relink may use. */
  stretch: ShownUnit[];
};

const button = "rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800";

/**
 * One verse of the edition beside the Nova Vulgata text of its units, with the link's confidence and the
 * reviewer's actions: accept, relink (to units of its stretch), no counterpart, flag a split, same/corresponding.
 * A link made by rule shows no actions.
 */
export function ReviewLink(p: ReviewLinkProps) {
  const t = useTranslations("Review");
  const [link, setLink] = useState(p.link);
  const [mode, setMode] = useState<"idle" | "relink" | "split">("idle");
  const [chosen, setChosen] = useState<string[]>(p.link.units);
  const [note, setNote] = useState("");
  const [failed, setFailed] = useState<false | "failed" | "changed">(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const refId = useId();
  // A new link from the server (after "accept all", or a reload) replaces the one shown: reset while rendering
  // when the prop changes (React's pattern for state that follows a prop).
  const [shownFor, setShownFor] = useState(p.link);
  if (p.link !== shownFor) {
    setShownFor(p.link);
    setLink(p.link);
    setChosen(p.link.units);
    setMode("idle");
  }

  const apply = async (change: ReviewChange) => {
    setBusy(true);
    setFailed(false);
    const r = await reviewLink(link.id, change);
    setBusy(false);
    if (r.ok) {
      setLink(r.link);
      setChosen(r.link.units);
      setMode("idle");
    } else {
      setFailed(r.status === 409 ? "changed" : "failed");
    }
  };

  const shown = link.units.map((id) => p.stretch.find((u) => u.id === id) ?? p.units.find((u) => u.id === id) ?? { id, ref: id, text: "" });
  const percent = link.confidence === null ? null : Math.round(link.confidence * 100);
  const status = { rule: t("statusRule"), draft: t("statusDraft"), reviewed: t("statusReviewed") }[link.status];

  return (
    <section
      data-testid="review-row"
      aria-labelledby={refId}
      className="grid grid-cols-1 gap-3 border-b border-slate-200 py-3 md:grid-cols-2 dark:border-slate-800"
    >
      <div>
        <p id={refId} className="font-sans text-xs text-slate-500 dark:text-slate-400">{link.ref}</p>
        <p className="font-serif">{p.text}</p>
      </div>
      <div>
        <p className="flex flex-wrap items-center gap-2 font-sans text-xs text-slate-500 dark:text-slate-400">
          <span>{t("nova")}</span>
          <span className={`rounded px-1.5 py-0.5 ${link.status === "reviewed" ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" : link.status === "draft" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-slate-100 dark:bg-slate-800"}`}>
            {status}
          </span>
          {link.kind === "corresponding" && <span>{t("kindCorresponding")}</span>}
          {link.note && <span>{link.note}</span>}
        </p>
        {shown.length === 0 ? (
          <p className="italic text-slate-500">{t("noUnits")}</p>
        ) : (
          shown.map((u) => (
            <p key={u.id} className="font-serif">
              <span className="mr-1 font-sans text-xs text-slate-500">{u.ref}</span>
              {u.text}
            </p>
          ))
        )}
        {percent !== null && (
          <div className="mt-1 h-1.5 w-full rounded bg-slate-200 dark:bg-slate-800" aria-label={t("confidence", { percent })} role="img">
            <div className={`h-1.5 rounded ${percent < 50 ? "bg-red-500" : percent < 75 ? "bg-amber-500" : "bg-green-600"}`} style={{ width: `${percent}%` }} />
          </div>
        )}

        {link.status !== "rule" && mode === "idle" && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={button} disabled={busy} onClick={() => apply({ action: "accept" })}>{t("accept")}</button>
            {p.stretch.length > 0 && <button type="button" className={button} disabled={busy} onClick={() => setMode("relink")}>{t("relink")}</button>}
            <button type="button" className={button} disabled={busy} onClick={() => apply({ action: "none" })}>{t("noCounterpart")}</button>
            <button type="button" className={button} disabled={busy} onClick={() => setMode("split")}>{t("split")}</button>
            <button type="button" className={button} disabled={busy} onClick={() => apply({ kind: link.kind === "same" ? "corresponding" : "same" })}>
              {link.kind === "same" ? t("makeCorresponding") : t("makeSame")}
            </button>
          </div>
        )}

        {mode === "relink" && (
          <fieldset className="mt-2 space-y-1">
            <legend className="text-sm font-medium">{t("relinkTo")}</legend>
            {p.stretch.map((u) => (
              <label key={u.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  value={u.id}
                  checked={chosen.includes(u.id)}
                  onChange={(e) => setChosen((c) => (e.target.checked ? p.stretch.map((x) => x.id).filter((id) => id === u.id || c.includes(id)) : c.filter((id) => id !== u.id)))}
                />
                <span><span className="font-sans text-xs text-slate-500">{u.ref}</span> {u.text}</span>
              </label>
            ))}
            <div className="flex gap-2 pt-1">
              <button type="button" className={button} disabled={busy || chosen.length === 0} onClick={() => apply({ action: "relink", units: chosen })}>{t("saveLinks")}</button>
              <button type="button" className={button} disabled={busy} onClick={() => setMode("idle")}>{t("cancel")}</button>
            </div>
          </fieldset>
        )}

        {mode === "split" && (
          <div className="mt-2 space-y-1">
            <label className="block text-sm">
              {t("splitNote")}
              <textarea className="mt-1 block w-full rounded border border-slate-300 p-1 dark:border-slate-700 dark:bg-slate-900" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <button type="button" className={button} disabled={busy || note.trim() === ""} onClick={() => apply({ action: "split", note })}>{t("flag")}</button>
              <button type="button" className={button} disabled={busy} onClick={() => setMode("idle")}>{t("cancel")}</button>
            </div>
          </div>
        )}

        {failed && (
          <div role="alert" className="mt-1 text-sm text-red-700 dark:text-red-400">
            {failed === "changed" ? t("changed") : t("failed")}
            {failed === "changed" && (
              <button type="button" className={`${button} ml-2`} onClick={() => router.refresh()}>{t("reload")}</button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
