/** The mobile notes panel's size, remembered in this browser: a bar, a quarter of the screen, or half. */
export type PanelSize = "bar" | "quarter" | "half";

const KEY = "bibleget.notesPanel";
const CHANGED = "bibleget:notesPanel";
export const DEFAULT_SIZE: PanelSize = "quarter";
const SIZES: readonly PanelSize[] = ["bar", "quarter", "half"];

export function loadPanelSize(): PanelSize {
  try {
    const v = localStorage.getItem(KEY);
    return SIZES.includes(v as PanelSize) ? (v as PanelSize) : DEFAULT_SIZE;
  } catch {
    return DEFAULT_SIZE;
  }
}

export function savePanelSize(size: PanelSize): void {
  try {
    localStorage.setItem(KEY, size);
  } catch {
    // Not remembered (private mode, storage full): the panel keeps the size until the page changes.
  }
  window.dispatchEvent(new Event(CHANGED));
}

/** For useSyncExternalStore: the size changes when this or another panel saves it. */
export function subscribePanelSize(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The next size a tap on the handle gives: quarter → half → bar → quarter. */
export function nextSize(s: PanelSize): PanelSize {
  return s === "quarter" ? "half" : s === "half" ? "bar" : "quarter";
}

/** The size nearest a dragged height, as a fraction of the screen. */
export function snapSize(fraction: number): PanelSize {
  return fraction < 0.14 ? "bar" : fraction < 0.38 ? "quarter" : "half";
}
