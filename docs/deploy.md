# Deployment

`.github/workflows/deploy.yml` is a manual workflow (`workflow_dispatch`) with a `target` input. Only `staging` exists today; production is added later as another option with its own variables.

## What it does

1. Validates the secrets and variables below, failing fast if any is empty.
2. `npm ci`, typecheck, tests, lint, then `next build` (standalone output). Any `.env*` file is removed first and the bundle is checked for one afterwards: **no configuration or secret is baked into the build**. The one exception is `BIBLEGET_RELEASE`, the bundle tag (`<run id>-<run attempt>`, not a secret), which `next.config.ts` inlines and `GET /api/version` reports.
3. Adds `.next/static` and `public` to `.next/standalone`, writes `.deploy-manifest.json`, and tars the result.
4. Uploads the tarball over `scp` to the chrooted `/tmp`, using the pinned host key (`StrictHostKeyChecking=yes`).
5. Over `ssh`: extracts into `VPS_APP_DIR`, removes `public/` first, then clears `.next/cache/fetch-cache` and `.next/server/route-cache`, touches `tmp/restart.txt` (Passenger restart) and, last, writes the marker `.deployed-<bundle tag>` (removing older markers). The step is retried, and a retry that finds this bundle's marker exits without touching the tree, so a lost acknowledgement cannot undo a completed deploy. A separate best-effort step removes the tarball afterwards.
6. Smoke test: retries until `GET $SITE_URL/api/version` reports this bundle's tag (the old process keeps answering until Passenger restarts it, and the id is read once at startup, so it cannot report the new one), then `GET $SITE_URL/en` returns 200 (no redirect followed) and, on staging, carries `X-Robots-Tag: noindex`.

## Repository secrets and variables

| Name | Kind | Example |
|---|---|---|
| `VPS_HOST` | secret | the VPS hostname |
| `VPS_USERNAME` | secret | the Plesk subscription system user (chrooted shell) |
| `VPS_SSH_KEY` | secret | private key for that user; restrict its `authorized_keys` entry with `restrict` |
| `VPS_HOST_KEY` | variable | output of `ssh-keyscan -t ed25519,rsa <host>` (known_hosts lines), **verified** as below |
| `VPS_APP_DIR` | variable | `staging.bibleget.io` (relative to the chroot home, i.e. the subscription webspace root) |
| `SITE_URL` | variable | `https://staging.bibleget.io` |

### Verifying the host key before pinning it

`ssh-keyscan` only collects whatever key answers; it does not authenticate the host. Before saving its output as `VPS_HOST_KEY`, compare fingerprints:

```bash
ssh-keyscan -t ed25519,rsa <host> > scanned_host_keys
ssh-keygen -lf scanned_host_keys                       # on your machine
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub       # on the VPS itself (provider console or an already trusted session)
```

Save the variable only if the ED25519 fingerprints match (likewise `ssh_host_rsa_key.pub` for the RSA line, or drop that line). The workflow's "no entry for the host" error asks for the same check when the key is regenerated.

## Server side (Plesk, already configured)

Subdomain `staging.bibleget.io` of the `bibleget.io` subscription; Node.js major version the same as `.nvmrc` (24); application root `/staging.bibleget.io`, document root `/staging.bibleget.io/public`, startup file `server.js`, mode production. All runtime environment variables (`AUTH_*`, `ZITADEL_PROJECT_ID`, `BIBLEGET_API_URL`, `BIBLEGET_READ_KEY`, `BIBLEGET_READER_KEY`, `SITE_NOINDEX=1`) are set in the Plesk Node.js panel, never in the repository or the bundle.

The chroot needs `tar`, `gzip`, `rm`, `mkdir` and `touch`. The runner is pinned to `ubuntu-24.04` to match the VPS glibc for native addons.

Each deploy replaces the whole `public/` document root, so anything Plesk puts there (such as `.well-known`) is removed; the wildcard certificate needs no HTTP challenge.

## Rollback

The workflow keeps no copy of the release it overwrites, so a rollback is a redeploy of an earlier build:

- **After a previous successful deploy:** open that run in the Actions tab and use **Re-run all jobs**. A re-run uses the run's original commit SHA (not the branch's current head), rebuilds it and deploys it; its bundle tag gains a new run attempt, so it is not mistaken for the release already live. This works while GitHub still retains the run and allows re-running it.
- **The first rollout** has no previous release to return to: it is staging only (`SITE_NOINDEX=1`), so a broken first deploy is fixed forward with a new commit, or by redeploying once the fix is merged.

Selecting an older branch or tag in the "Use workflow from" dropdown is not a rollback path for a revision that predates `deploy.yml` (the workflow does not exist there). Extraction is over the previous release, so stale files may remain; they are harmless.
