"use client";

/**
 * The sign-out form's button. It also forgets the pages kept for offline reading (public/sw.js): a signed-in
 * reader's pages hold the full text and their name, and the next person on this device should not find them.
 * It tells the worker too, so a page still loading is not kept; a form sent before this script ran is covered by
 * the redirect's `?signed-out` mark (components/AuthStatus.tsx), which the worker sees.
 */
export function SignOutButton({ label, className }: { label: string; className: string }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={() => {
        if (typeof caches !== "undefined") void caches.delete("bg-pages").catch(() => undefined);
        if (typeof navigator !== "undefined") navigator.serviceWorker?.controller?.postMessage({ type: "signed-out" });
      }}
    >
      {label}
    </button>
  );
}
