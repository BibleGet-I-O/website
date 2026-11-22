/*
 * BibleGet's service worker: the site as an installable app whose chapters, once read, still open offline.
 *
 * - Pages a reader keeps (the home page, an edition's books, its chapters, the compare views) are fetched from the
 *   network first, so online they are never stale, and the answer is kept: offline, a chapter already read opens
 *   from here. At most MAX_PAGES are kept, the least recently read dropped first.
 * - A page that was never read, offline, gets /offline.html, which lists the chapters that are kept.
 * - The app's built files (/_next/static/, named by their content) are kept once fetched.
 * - Search, the API reference, admin, review, the site's /api and other sites are left to the network.
 * - Signing out clears the kept pages (components/SignOutButton.tsx): a signed-in reader's pages hold the full
 *   text and their name.
 *
 * Only what the reader was shown is kept, on their own device, as a browser cache would: nothing is fetched ahead.
 */

const PAGES = "bg-pages";
const STATIC = "bg-static";
const SHELL = "bg-shell-v1";
const MAX_PAGES = 200;
const MAX_STATIC = 300;
const SHELL_URLS = ["/offline.html", "/bibleget-logo.png"];
const LOCALES = ["en", "it", "es", "fr", "de", "pt"];

/** A page a reader keeps: /{locale}, or under /{locale}/read, but not search results. */
function isKeptPage(url) {
  const m = url.pathname.match(/^\/([a-z]{2})(\/.*)?$/);
  if (!m || !LOCALES.includes(m[1])) return false;
  const rest = m[2] || "/";
  if (rest === "/") return true;
  return /^\/read(\/|$)/.test(rest) && !/\/search(\/|$)/.test(rest);
}

/** Keeps at most `max` entries in a cache, dropping the oldest first. */
async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function keep(name, request, response, max) {
  const cache = await caches.open(name);
  // Deleted first, so a page read again becomes the newest.
  await cache.delete(request);
  await cache.put(request, response);
  await trim(name, max);
}

async function page(request) {
  try {
    const response = await fetch(request);
    if (response.ok) await keep(PAGES, request, response.clone(), MAX_PAGES);
    return response;
  } catch (err) {
    const kept = await (await caches.open(PAGES)).match(request);
    if (kept) return kept;
    const offline = await caches.match("/offline.html");
    if (offline) return offline;
    throw err;
  }
}

async function built(request) {
  const kept = await (await caches.open(STATIC)).match(request);
  if (kept) return kept;
  const response = await fetch(request);
  if (response.ok) await keep(STATIC, request, response.clone(), MAX_STATIC);
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n.startsWith("bg-shell-") && n !== SHELL).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // A client-side navigation's payload: left to the network; offline, Next falls back to loading the page.
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return;
  if (request.mode === "navigate") {
    if (isKeptPage(url)) event.respondWith(page(request));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(built(request));
    return;
  }
  // The offline page's own files (its logo), kept at install: offline, from the cache.
  if (SHELL_URLS.includes(url.pathname)) {
    event.respondWith(fetch(request).catch(() => caches.match(url.pathname)));
  }
});
