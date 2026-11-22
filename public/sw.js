/*
 * BibleGet's service worker: the site as an installable app whose chapters, once read, still open offline.
 *
 * - Pages a reader keeps (the home page, an edition's books, its chapters, the compare views) are fetched from the
 *   network first, so online they are never stale, and the answer is kept: offline, a chapter already read opens
 *   from here. At most MAX_PAGES are kept, the least recently read dropped first.
 * - A page that was never read, offline, gets /offline.html, which lists the chapters that are kept.
 * - The app's built files (/_next/static/, named by their content) are kept once fetched.
 * - Search, the API reference, admin, review, the site's /api and other sites are left to the network.
 * - A chapter reached inside the app (a client-side navigation fetches only its payload) is kept when the page
 *   asks (a "keep" message from components/ServiceWorkerRegister.tsx), and so is the page that first installed the
 *   worker, with its built files: the worker fetches that page again, never one the reader has not opened.
 * - The app's start page, "/", is the server's (it sends the reader to their language); offline it opens the home
 *   page kept in the reader's language.
 * - Signing out clears the kept pages: a signed-in reader's pages hold the full text and their name. The sign-out
 *   redirect ends in ?signed-out, which the worker sees whether the form was sent by the page's script or before it
 *   loaded; the button also sends a "signed-out" message. A page still loading when the reader signs out is not kept.
 * - Keeping a copy never holds back or breaks the answer: the page streams while its copy is written, and a failed
 *   write leaves the earlier copy.
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
const SIGNED_OUT = "signed-out";

// Bumped when the reader signs out: a page whose request started before is not kept.
let epoch = 0;

/** A page a reader keeps: /{locale}, or under /{locale}/read, but not search results. */
function isKeptPage(url) {
  if (url.searchParams.has(SIGNED_OUT)) return false;
  const m = url.pathname.match(/^\/([a-z]{2})(\/.*)?$/);
  if (!m || !LOCALES.includes(m[1])) return false;
  const rest = m[2] || "/";
  if (rest === "/") return true;
  return /^\/read(\/|$)/.test(rest) && !/\/search(\/|$)/.test(rest);
}

async function forgetPages() {
  epoch++;
  await caches.delete(PAGES);
}

/** An entry of a cache, or nothing when it cannot be read. */
async function fromCache(name, request) {
  try {
    return await (await caches.open(name)).match(request);
  } catch {
    return undefined;
  }
}

/** Keeps at most `max` entries in a cache, dropping the oldest first. */
async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

/**
 * Keeps a copy, as the newest entry (deleted first, then written again). A failed write puts the earlier copy
 * back; `still` is asked just before writing (a sign-out may have come meanwhile).
 */
async function keep(name, request, response, max, still = () => true) {
  const cache = await caches.open(name);
  const earlier = await cache.match(request);
  if (!still()) return;
  await cache.delete(request);
  try {
    await cache.put(request, response);
  } catch (err) {
    if (earlier) await cache.put(request, earlier).catch(() => undefined);
    throw err;
  }
  await trim(name, max);
}

/** Best effort, while the worker stays alive for the answer: a failure is not the reader's. */
function meanwhile(event, work) {
  event.waitUntil(work.catch(() => undefined));
}

async function offline(err) {
  const page = await fromCache(SHELL, "/offline.html");
  if (page) return page;
  throw err;
}

async function page(event) {
  const request = event.request;
  const since = epoch;
  const still = () => since === epoch;
  let response;
  try {
    response = await fetch(request);
  } catch (err) {
    const kept = await fromCache(PAGES, request);
    if (!kept) return offline(err);
    // Read again: it becomes the newest, so trimming drops a page read longer ago.
    meanwhile(event, keep(PAGES, request, kept.clone(), MAX_PAGES, still));
    return kept;
  }
  if (response.ok) meanwhile(event, keep(PAGES, request, response.clone(), MAX_PAGES, still));
  return response;
}

/** "/": the server's answer online; offline, the home page kept in the reader's language, or any kept. */
async function start(event) {
  try {
    return await fetch(event.request);
  } catch (err) {
    const preferred = ((self.navigator && self.navigator.languages) || []).map((l) => l.slice(0, 2));
    for (const lang of [...preferred, ...LOCALES]) {
      if (!LOCALES.includes(lang)) continue;
      const home = await fromCache(PAGES, "/" + lang);
      if (home) return home;
    }
    return offline(err);
  }
}

async function built(event) {
  const request = event.request;
  const kept = await fromCache(STATIC, request);
  if (kept) return kept;
  const response = await fetch(request);
  if (response.ok) meanwhile(event, keep(STATIC, request, response.clone(), MAX_STATIC));
  return response;
}

/** The pages a page asks to keep (one reached in the app, or the page that installed the worker) and its files. */
async function keepAsked(urls) {
  const since = epoch;
  for (const u of urls.slice(0, 100)) {
    let url;
    try {
      url = new URL(u, self.location.origin);
    } catch {
      continue;
    }
    if (url.origin !== self.location.origin) continue;
    try {
      if (url.pathname.startsWith("/_next/static/")) {
        if (await fromCache(STATIC, url.href)) continue;
        const response = await fetch(url.href);
        if (response.ok) await keep(STATIC, url.href, response, MAX_STATIC);
      } else if (isKeptPage(url)) {
        const response = await fetch(url.href, { credentials: "same-origin" });
        if (response.ok) await keep(PAGES, url.href, response, MAX_PAGES, () => since === epoch);
      }
    } catch {
      // Best effort: the next visit keeps it.
    }
  }
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

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === SIGNED_OUT) event.waitUntil(forgetPages());
  else if (data.type === "keep" && Array.isArray(data.urls)) event.waitUntil(keepAsked(data.urls));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // The sign-out redirect, as a page load or a client-side navigation: forget the pages kept.
  if (url.searchParams.has(SIGNED_OUT)) event.waitUntil(forgetPages());
  // A client-side navigation's payload: left to the network (the page asks for its document to be kept);
  // offline, Next falls back to loading the page, which the worker serves.
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return;
  if (request.mode === "navigate") {
    if (url.pathname === "/") event.respondWith(start(event));
    else if (isKeptPage(url)) event.respondWith(page(event));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(built(event));
    return;
  }
  // The offline page's own files (its logo), kept at install: offline, from the cache.
  if (SHELL_URLS.includes(url.pathname)) {
    event.respondWith(fetch(request).catch(() => caches.match(url.pathname)));
  }
});
