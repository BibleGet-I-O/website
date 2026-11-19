# Deployment

`.github/workflows/deploy.yml` is a manual workflow (`workflow_dispatch`) with a `target` input. Only `staging` exists today; production is added later as another option with its own variables.

## What it does

1. Validates the secrets and variables below, failing fast if any is empty.
2. `npm ci`, typecheck, tests, lint, then `next build` (standalone output). Any `.env*` file is removed first and the bundle is checked for one afterwards: **no configuration or secret is baked into the build**.
3. Adds `.next/static` and `public` to `.next/standalone`, writes `.deploy-manifest.json`, and tars the result.
4. Uploads the tarball over `scp` to the chrooted `/tmp`, using the pinned host key (`StrictHostKeyChecking=yes`).
5. Over `ssh`: extracts into `VPS_APP_DIR`, removes `public/` first, then clears `.next/cache/fetch-cache` and `.next/server/route-cache`, touches `tmp/restart.txt` (Passenger restart), and removes the tarball last so a retry can re-extract.
6. Smoke test: `GET $SITE_URL/en` returns 200 (no redirect followed) and, on staging, carries `X-Robots-Tag: noindex`.

## Repository secrets and variables

| Name | Kind | Example |
|---|---|---|
| `VPS_HOST` | secret | the VPS hostname |
| `VPS_USERNAME` | secret | the Plesk subscription system user (chrooted shell) |
| `VPS_SSH_KEY` | secret | private key for that user; restrict its `authorized_keys` entry with `restrict` |
| `VPS_HOST_KEY` | variable | output of `ssh-keyscan -t ed25519,rsa <host>` (known_hosts lines) |
| `VPS_APP_DIR` | variable | `staging.bibleget.io` (relative to the chroot home, i.e. the subscription webspace root) |
| `SITE_URL` | variable | `https://staging.bibleget.io` |

## Server side (Plesk, already configured)

Subdomain `staging.bibleget.io` of the `bibleget.io` subscription; Node.js major version the same as `.nvmrc` (24); application root `/staging.bibleget.io`, document root `/staging.bibleget.io/public`, startup file `server.js`, mode production. All runtime environment variables (`AUTH_*`, `ZITADEL_PROJECT_ID`, `BIBLEGET_API_URL`, `BIBLEGET_READ_KEY`, `BIBLEGET_READER_KEY`, `SITE_NOINDEX=1`) are set in the Plesk Node.js panel, never in the repository or the bundle.

The chroot needs `tar`, `gzip`, `rm`, `mkdir` and `touch`. The runner is pinned to `ubuntu-24.04` to match the VPS glibc for native addons.

Each deploy replaces the whole `public/` document root, so anything Plesk puts there (such as `.well-known`) is removed; the wildcard certificate needs no HTTP challenge.

## Rollback

Re-run the workflow from an earlier commit (select the branch or tag in the "Use workflow from" dropdown). Extraction is over the previous release, so stale files may remain; they are harmless.
