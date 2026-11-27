/** Whether the reader marks the persons and places named in the text, remembered in this browser (off by default). */
const KEY = "reader.annotations";
const CHANGED = "bibleget:annotations";

export function loadAnnotations(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function saveAnnotations(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // Not remembered (private mode, storage full): the marks stay as chosen until the page changes.
  }
  window.dispatchEvent(new Event(CHANGED));
}

/** For useSyncExternalStore: the choice changes when this or another tab saves it. */
export function subscribeAnnotations(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}
