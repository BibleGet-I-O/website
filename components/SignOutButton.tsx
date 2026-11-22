"use client";

/**
 * The sign-out form's button. It also forgets the pages kept for offline reading (public/sw.js): a signed-in
 * reader's pages hold the full text and their name, and the next person on this device should not find them.
 */
export function SignOutButton({ label, className }: { label: string; className: string }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={() => {
        if (typeof caches !== "undefined") void caches.delete("bg-pages").catch(() => undefined);
      }}
    >
      {label}
    </button>
  );
}
