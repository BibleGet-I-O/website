# CLAUDE.md

BibleGet website: a Next.js reader for the BibleGet I/O endpoint (`https://query.bibleget.io/`). Design: `docs/specs/2026-11-19-website-reader-design.md`.

## Stack

Next.js 16 (App Router, `output: "standalone"`), React 19, TypeScript, next-auth 5 beta (Zitadel), next-intl 4, Tailwind 4, Vitest + Testing Library, ESLint. Node >= 24 (`.nvmrc`). Modelled on `CatholicOS/martyrology-frontend`; read `node_modules/next/dist/docs/` before using Next APIs.

## Commands

```bash
npm install
npm run dev        # http://localhost:3000/en
npm run lint
npm run typecheck
npm test
npm run build
npm run sync-messages   # copy missing English strings into it/es/fr/de/pt
```

## Rules

- API keys (`BIBLEGET_READ_KEY`, `BIBLEGET_READER_KEY`) and the Zitadel access token are server-only: use `import "server-only"`, never pass them to a client component, the Session object or a response body. The access token lives only in the encrypted next-auth JWT cookie.
- The site never decides copyright: visitors use the read key, signed-in users with a verified email the reader key.
- Staging sets `SITE_NOINDEX=1`: robots disallows all and `X-Robots-Tag: noindex, nofollow` is sent by `proxy.ts` at request time (so setting it on the running app is enough).
- Locales: en, it, es, fr, de, pt. English is complete; add strings to `messages/en.json` then run `npm run sync-messages`.
- Never commit `.env*` (except `.env.example`), `node_modules` or `.next`. Stage files by name.
