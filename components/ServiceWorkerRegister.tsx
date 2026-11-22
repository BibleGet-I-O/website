"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

const MARK = "signed-out";

/** This page's address, without the sign-out redirect's mark (dropped from the address bar too). */
function here(): string {
  const params = new URLSearchParams(location.search);
  if (params.has(MARK)) {
    params.delete(MARK);
    const rest = params.toString();
    history.replaceState(history.state, "", location.pathname + (rest ? `?${rest}` : "") + location.hash);
  }
  return location.pathname + location.search;
}

/** The app's built files this page has loaded so far. */
function builtFiles(): string[] {
  return performance
    .getEntriesByType("resource")
    .map((e) => new URL(e.name, location.href))
    .filter((u) => u.origin === location.origin && u.pathname.startsWith("/_next/static/"))
    .map((u) => u.pathname + u.search);
}

/**
 * Registers the service worker (public/sw.js), in production builds only: in development it would cache stale code.
 *
 * It also tells the worker what to keep that it could not see itself:
 * - on the first install, this page and the built files it loaded, listed once the worker has taken over the page
 *   (from then on the worker sees every request), so none loaded meanwhile is missed;
 * - each page reached inside the app, a new path or only a new query (a comparison added), whose navigation fetched
 *   only a payload, not the page.
 * And it drops the `?signed-out` mark the sign-out redirect leaves (the worker has forgotten the pages kept).
 */
export function ServiceWorkerRegister() {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const first = useRef(true);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const sw = navigator.serviceWorker;
    const marked = new URLSearchParams(location.search).has(MARK);
    const url = here();
    if (!first.current) {
      // Reached by signing out: the worker has just forgotten the pages; the home page is kept on its next load.
      if (!marked) sw.controller?.postMessage({ type: "keep", urls: [url] });
      return;
    }
    first.current = false;
    const installing = !sw.controller;
    sw.register("/sw.js", { scope: "/" }).catch(() => undefined);
    if (!installing) return;
    // Not removed on a later render: a navigation before the worker takes over must not lose it (the layout,
    // and so this component, stays mounted).
    sw.addEventListener("controllerchange", () => sw.controller?.postMessage({ type: "keep", urls: [url, ...builtFiles()] }), { once: true });
  }, [pathname, query]);
  return null;
}
