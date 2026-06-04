# Plan: Migrate hosting from Railway to Render (DB stays on Neon)

**Date:** 2026-06-03
**Type:** deploy
**Status:** proposed

## Problem statement

The free Railway trial has expired, so L₇ is no longer hosted. Railway ran two
services (Node SSR frontend, FastAPI backend) against a PostgreSQL database that
was actually hosted on **Neon** (confirmed: the dump's objects are owned by
`neondb_owner`, and the Neon project is still live with all user/budget/entry
data intact). We need a free home for the two app services. The database does
not need to move — it already persists for free on Neon.

## Approach

Keep the database where it is; re-host only the two app services on **Render**
free web services.

| Piece | Host | Notes |
|---|---|---|
| PostgreSQL 18 | **Neon** (existing project) | Already live with data. No restore needed. |
| FastAPI backend | **Render** free web service (Python) | asyncpg + Alembic keep working (unlike Cloudflare Workers). Spins down after 15 min idle. |
| React Router v7 SSR frontend | **Render** free web service (Node) | `react-router-serve`. Spins down after 15 min idle. |

Key decisions:
- **Reuse the existing `DATABASE_URL` verbatim.** The backend already connected
  to this Neon DB from Railway, so the connection string (asyncpg scheme + SSL /
  pooler params) is already proven. Do not hand-reconstruct it — copy the value
  that worked.
- **No database migration / restore.** Neon project is intact. The `.sql` dump at
  `~/development/ledger-sub-7-4-10-2026-dump.sql` is kept only as a backup.
- **Alembic on deploy is a safe no-op.** The Neon DB is already at head, so
  `alembic upgrade head` during the backend's build/start does nothing harmful
  and protects future deploys.
- **Cookie domain is a non-issue.** Cookies are set first-party on the
  *frontend* domain (browser only ever talks to the frontend; frontend SSR ↔
  backend is server-to-server). Different `*.onrender.com` subdomains do not
  break this.
- **Accept Render cold starts (~1 min).** Acceptable for a personal tracker. If
  annoying, keep the backend warm with an external cron ping later (out of scope
  here).

## Steps

1. **Backend Render service** (root dir `backend/`, env: Python)
   - Build command: `pip install -r requirements.txt && alembic upgrade head`
   - Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Env vars: `DATABASE_URL` (copy proven Neon string), `GOOGLE_CLIENT_ID`,
     `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `JWT_EXPIRE_DAYS=14`,
     `FRONTEND_URL` (the frontend Render URL), `ENVIRONMENT=production`.
2. **Frontend Render service** (root dir `frontend/`, env: Node)
   - Build command: `npm install && npm run build`
   - Start command: `npm run start` (`react-router-serve`; respects `$PORT`).
   - Env var: `BACKEND_URL` (the backend Render URL).
3. **Resolve the URL chicken-and-egg.** Create both services, note their
   `*.onrender.com` URLs, then set `FRONTEND_URL` (backend) and `BACKEND_URL`
   (frontend) and redeploy.
4. **Google OAuth console.** Add the new frontend Render URL's OAuth callback
   (`https://<frontend>.onrender.com/auth/callback`) to Authorized redirect URIs,
   and the frontend origin to Authorized JavaScript origins. Remove old Railway
   URLs.
5. **Smoke test:** load the app, sign in with Google, confirm an existing user's
   data (e.g. e.s.seviere@gmail.com) loads, add + edit + delete an entry,
   check the weekly report.

## Files affected

- `docs/plans/2026-06-03-deploy-render-migration.md` (this file).
- `render.yaml` blueprint at repo root defining both free web services
  (declarative deploy). **Created.**
- No application code changes expected. `CLAUDE.md` PG version already corrected
  (16 → 18 prod / 16 local) in a separate edit.

## Open questions / verify during execution

- **Neon pooled vs direct endpoint:** confirm the reused `DATABASE_URL` points at
  the pooled (`-pooler`) host. If asyncpg + PgBouncer throws prepared-statement
  errors, append `statement_cache_size=0` (or use the direct endpoint). Only
  relevant if the old string used the pooler and errors appear.
- **Render free Python build time:** if `pip install` is slow/cold, no action
  needed — just expect a slower first deploy.

## Acceptance criteria

- Both Render services build and go live on their free tier.
- Google sign-in works end-to-end from the new frontend URL.
- Pre-existing data (users, budgets, entries) is visible — proving Neon
  connectivity, not a fresh DB.
- Create / edit / delete entry and the weekly report all function.
- No application code changes were required to achieve the above.
