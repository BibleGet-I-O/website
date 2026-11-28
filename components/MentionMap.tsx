"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
// Leaflet's stylesheet comes with this module, which the card loads only for a place with coordinates (React.lazy in
// MentionCard), so neither Leaflet nor its CSS weighs on the reader otherwise.
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import { ESRI_ATTRIBUTION, ESRI_STREET_TILES } from "@/lib/esri-tiles";

// The credit's links open in a new tab, like the card's other external links.
const CREDIT_HTML = ESRI_ATTRIBUTION.replaceAll("<a ", '<a target="_blank" rel="noopener noreferrer" ');

export type MentionMapProps = { lat: number; lon: number; label: string; uncertain: boolean };

/**
 * A place's site on a small map in its card (after the martyrology's). Only the zoom buttons work, so scrolling or
 * dragging over it moves the page. Leaflet's own attribution control is off: the full Esri credit would cover most of
 * a map this small, so a short "© Esri" and a toggle stand in for it, and the toggle opens the full credit. Where
 * CBPPEDR marks the identification uncertain, a label says the site is uncertain.
 */
export default function MentionMap({ lat, lon, label, uncertain }: MentionMapProps) {
  const t = useTranslations("Reader.mentions");
  const el = useRef<HTMLDivElement>(null);
  const [credits, setCredits] = useState(false);
  const zoomIn = t("zoomIn");
  const zoomOut = t("zoomOut");
  useEffect(() => {
    let map: LeafletMap | null = null;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      map = L.map(el.current, {
        dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false,
        attributionControl: false, zoomControl: false,
      });
      // Leaflet's own zoom buttons are titled (and named, the title being their aria-label) in English only.
      L.control.zoom({ zoomInTitle: zoomIn, zoomOutTitle: zoomOut }).addTo(map);
      L.tileLayer(ESRI_STREET_TILES, { maxZoom: 18, attribution: ESRI_ATTRIBUTION }).addTo(map);
      L.circleMarker([lat, lon], { color: "#b91c1c", fillColor: "#ef4444", radius: 7, weight: 2, fillOpacity: 0.8 }).addTo(map);
      map.setView([lat, lon], 8);
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lon, zoomIn, zoomOut]);
  return (
    <div className="relative mt-2 h-40 w-full">
      <div ref={el} role="group" aria-label={label} className="h-full w-full rounded border border-slate-300 dark:border-slate-700" />
      {/* Above Leaflet's panes (z-index up to 1000), and outside the labelled map box. */}
      {uncertain && (
        <span className="absolute right-px top-px z-[1000] rounded-bl border-b border-l border-amber-600 bg-amber-50/95 px-1.5 py-0.5 font-sans text-xs text-amber-800 dark:border-amber-400 dark:bg-slate-900/95 dark:text-amber-300">
          {t("siteUncertain")}
        </span>
      )}
      <div className="absolute bottom-px right-px z-[1000] flex max-h-[calc(100%-2px)] max-w-full items-end rounded-tl bg-white/90 text-[0.6rem] leading-tight text-slate-700 dark:bg-slate-900/90 dark:text-slate-300">
        {credits ? (
          <div className="max-h-full overflow-y-auto px-1 py-0.5 [&_a]:underline" dangerouslySetInnerHTML={{ __html: CREDIT_HTML }} />
        ) : (
          <span className="px-1">© Esri</span>
        )}
        <button
          type="button"
          onClick={() => setCredits((c) => !c)}
          aria-expanded={credits}
          aria-label={t("mapCredits")}
          title={t("mapCredits")}
          className="shrink-0 px-1 font-bold underline focus-visible:outline focus-visible:outline-2"
        >
          {credits ? "×" : "i"}
        </button>
      </div>
    </div>
  );
}
