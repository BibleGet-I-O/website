/** Whether the reader marks the persons and places named in the text, remembered in this browser (off by default). */
const KEY = "reader.annotations";
const CHANGED = "bibleget:annotations";

// The choice a failed write could not remember (private mode, storage full): kept here until a write succeeds or
// another tab saves one, so the marks stay as chosen until the page changes. Null while storage holds the choice.
let unsaved: boolean | null = null;

export function loadAnnotations(): boolean {
  if (unsaved !== null) return unsaved;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function saveAnnotations(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
    unsaved = null;
  } catch {
    unsaved = on;
  }
  window.dispatchEvent(new Event(CHANGED));
}

/** For useSyncExternalStore: the choice changes when this or another tab saves it. */
export function subscribeAnnotations(onChange: () => void): () => void {
  const other = (e: StorageEvent) => {
    if (e.key !== null && e.key !== KEY) return;
    unsaved = null;
    onChange();
  };
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", other);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", other);
  };
}
