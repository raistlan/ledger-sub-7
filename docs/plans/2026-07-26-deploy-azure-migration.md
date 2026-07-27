# Plan: Migrate hosting from Render to Azure free tier (DB stays on Neon)

**Date:** 2026-07-26
**Type:** deploy
**Status:** proposed

## Problem statement

L₇ currently runs two Render free web services (Node SSR frontend, FastAPI
backend) against a PostgreSQL database hosted on **Neon** (see
`2026-06-03-deploy-render-migration.md`). We want to move the two app services to
**Microsoft Azure's free options** while staying at $0 infrastructure cost. The
database does not need to move — it already persists for free on Neon with all
user/budget/entry data intact.

## Approach

Re-host only the two app services on **Azure App Service (F1 free plan)**; keep
the database on Neon; keep the custom domain on HTTPS by fronting Azure with
**Cloudflare's free plan**.

| Piece | Host | Notes |
|---|---|---|
| PostgreSQL | **Neon** (existing project) | Already live with data. No restore needed. Reuse the proven `DATABASE_URL` verbatim. |
| FastAPI backend | **Azure App Service**, Python 3.12 Linux, **F1 free** | Custom startup command (gunicorn + uvicorn worker). |
| React Router v7 SSR frontend | **Azure App Service**, Node 22, **F1 free** | `npm run start` (`react-router-serve`, respects `$PORT` via `WEBSITES_PORT`/`PORT`). |
| Custom domain HTTPS | **Cloudflare free plan** in front of `*.azurewebsites.net` | Edge TLS on `ledgersub7.raistlanschade.com`, proxied to the Azure origin. |

### Why these choices (key decisions)

- **Frontend goes on App Service, NOT Static Web Apps.** Azure Static Web Apps'
  SSR support is Next.js-only (hybrid, preview). It does not run a generic
  long-running React Router v7 (Remix-style) Node SSR server. App Service (Node)
  is the correct home — the same model as the current Render Node service.
  (Microsoft Learn: "Next.js support on Azure Static Web Apps".)
- **Database stays on Neon (free forever).** Azure Database for PostgreSQL
  Flexible Server's free offer (B1ms, 750 hrs/mo, 32 GB) is tied to a *new Azure
  free account and lasts only 12 months*, then converts to paid. Neon's free tier
  has no such clock, so keeping it is the lower-risk, genuinely-free path. Reuse
  the existing `DATABASE_URL` verbatim; no migration/restore.
- **Custom domain requires Cloudflare, because F1 cannot serve it over HTTPS.**
  Per Microsoft docs (updated 2026-04): custom domains require a *paid* tier (not
  F1), and custom TLS/SSL bindings require Basic (B1)+. Cloudflare's free plan
  terminates HTTPS at its edge for `ledgersub7.raistlanschade.com` and proxies to
  the `*.azurewebsites.net` origin (which has its own Azure-managed TLS), keeping
  total cost at $0.
- **Alembic on deploy is a safe no-op.** The Neon DB is already at head, so
  `alembic upgrade head` during backend build does nothing harmful and protects
  future deploys.

## F1 free-tier constraints to design around

- **60 CPU-minutes/day per app** (hard quota). Two apps = two independent
  buckets. Exceeding it stops the app until the next day. Acceptable for a
  personal tracker; watch it during smoke testing.
- **Sleeps after ~20 min idle** → cold start. The existing browser-driven backend
  wake feature (`2026-06-04-feat-browser-driven-backend-wake.md`) carries over
  and covers this.
- **No Always-On on F1** (setting is unavailable). Do not rely on it.

## Steps

1. **Provision (Azure portal or `az` CLI).** One resource group, one F1 App
   Service plan (Linux), two Web Apps on it — `l7-frontend` (Node 22) and
   `l7-backend` (Python 3.12).
2. **Backend Web App** (deploy from `backend/`):
   - Startup command:
     `gunicorn -w 2 -k uvicorn.workers.UvicornWorker app.main:app`
   - Build: Oryx runs `pip install -r requirements.txt`. Run
     `alembic upgrade head` via a post-build/startup step (or a one-off SSH run).
   - App settings: `DATABASE_URL` (copy proven Neon string), `GOOGLE_CLIENT_ID`,
     `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `JWT_EXPIRE_DAYS=14`,
     `ENVIRONMENT=production`, `FRONTEND_URL` (custom domain),
     `SCM_DO_BUILD_DURING_DEPLOYMENT=true`.
   - Health check path: `/api/v1/health`.
3. **Frontend Web App** (deploy from `frontend/`):
   - Startup command: `npm run start`.
   - Build: Oryx runs `npm install --include=dev && npm run build`
     (dev deps required for the build — same fix as the Render migration).
   - App settings: `NODE_ENV=production`, `GOOGLE_CLIENT_ID`,
     `GOOGLE_REDIRECT_URI=https://ledgersub7.raistlanschade.com/auth/callback`,
     `BACKEND_URL` (backend URL), `SCM_DO_BUILD_DURING_DEPLOYMENT=true`.
4. **Resolve the URL chicken-and-egg.** Create both apps, note their
   `*.azurewebsites.net` URLs, set `FRONTEND_URL` / `BACKEND_URL`, redeploy.
   (Backend↔frontend is server-to-server, so it can use the `*.azurewebsites.net`
   host directly; the custom domain only needs to front the browser-facing
   frontend.)
5. **Cloudflare in front of the frontend.** Point
   `ledgersub7.raistlanschade.com` at Cloudflare (proxied), origin =
   `l7-frontend.azurewebsites.net`. Use Full (strict) SSL mode. Confirm Azure
   accepts the proxied `Host` header for the frontend app.
6. **Google OAuth console.** Ensure Authorized redirect URI
   `https://ledgersub7.raistlanschade.com/auth/callback` and the custom-domain
   JavaScript origin are present. Remove old Render URLs once cut over.
7. **Smoke test:** load via the custom domain, sign in with Google, confirm an
   existing user's data (e.g. e.s.seviere@gmail.com) loads, add + edit + delete an
   entry, check the weekly report, and verify cold-start wake still works.

## Files affected

- `docs/plans/2026-07-26-deploy-azure-migration.md` (this file).
- New Azure deploy config at repo root — e.g. `azure-webapps.bicep` /
  `main.bicep` or GitHub Actions workflows under `.github/workflows/`
  (`azure-frontend.yml`, `azure-backend.yml`) for declarative deploy. **To be
  created once approach is confirmed.**
- `render.yaml` — leave in place until Azure is verified live, then remove in a
  follow-up commit.
- `CLAUDE.md` Deployment line — update Railway/Render → Azure + Neon (currently
  stale; separate small edit).
- No application code changes expected (same as the Render migration).

## Open questions / verify during execution

- **Port binding:** App Service sets `PORT` and expects the app to listen on it;
  confirm `react-router-serve` and uvicorn/gunicorn bind to `$PORT` (set
  `WEBSITES_PORT` if Azure doesn't auto-detect).
- **Alembic timing on Azure:** Oryx build differs from Render; decide whether to
  run migrations in a startup script vs a one-off SSH session so a slow/failed
  migration doesn't wedge the F1 start.
- **Neon pooled vs direct endpoint / asyncpg + PgBouncer:** if prepared-statement
  errors appear, append `statement_cache_size=0` or use the direct endpoint
  (same caveat as the Render migration).
- **Cloudflare host header:** verify the frontend serves correctly behind
  Cloudflare's proxy (redirects, cookie domain) on the custom domain.
- **60 CPU-min/day quota:** monitor during testing; if the frontend build/SSR is
  CPU-heavy, confirm it doesn't exhaust the daily quota.

## Acceptance criteria

- Both App Service apps build and go live on the F1 free plan.
- `https://ledgersub7.raistlanschade.com` serves the frontend over HTTPS via
  Cloudflare, at $0 infra cost.
- Google sign-in works end-to-end from the custom domain.
- Pre-existing data (users, budgets, entries) is visible — proving Neon
  connectivity, not a fresh DB.
- Create / edit / delete entry and the weekly report all function.
- Cold-start wake behaves as before.
- No application code changes were required.
