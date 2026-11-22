"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const here = () => location.pathname + location.search;

/**
 * Registers the service worker (public/sw.js), in production builds only: in development it would cache stale code.
 *
 * It also tells the worker what to keep that it could not see itself:
 * - on the first install, this page and its built files, loaded before the worker ran;
 * - each page reached inside the app, whose navigation fetched only a payload, not the page.
 * And it drops the `?signed-out` mark the sign-out redirect leaves (the worker has forgotten the pages kept).
 */
export function ServiceWorkerRegister() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const sw = navigator.serviceWorker;
    if (!first.current) {
      sw.controller?.postMessage({ type: "keep", urls: [here()] });
      return;
    }
    first.current = false;
    const params = new URLSearchParams(location.search);
    if (params.has("signed-out")) {
      params.delete("signed-out");
      const rest = params.toString();
      history.replaceState(history.state, "", location.pathname + (rest ? `?${rest}` : "") + location.hash);
    }
    const installing = !sw.controller;
    sw.register("/sw.js", { scope: "/" }).catch(() => undefined);
    if (!installing) return;
    const files = performance
      .getEntriesByType("resource")
      .map((e) => new URL(e.name, location.href))
      .filter((u) => u.origin === location.origin && u.pathname.startsWith("/_next/static/"))
      .map((u) => u.pathname + u.search);
    const urls = [here(), ...files];
    sw.ready.then((reg) => reg.active?.postMessage({ type: "keep", urls })).catch(() => undefined);
  }, [pathname]);
  return null;
}
