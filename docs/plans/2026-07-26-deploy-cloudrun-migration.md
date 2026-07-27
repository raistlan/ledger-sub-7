# Plan: Migrate hosting to Google Cloud Run (DB stays on Neon)

**Date:** 2026-07-26
**Type:** deploy
**Status:** proposed

## Problem statement

L₇ currently runs two Render free web services (Node SSR frontend, FastAPI
backend) against a PostgreSQL database on **Neon**. We want a genuinely
free-forever host with better limits than Render's 750-instance-hours/workspace
cap and no per-day CPU cap like Azure F1. **Google Cloud Run** has an always-free
tier (2M requests, 180k vCPU-sec, 360k GiB-sec per month, aggregated per billing
account, never expires) and runs arbitrary containers, which fits both a
React Router v7 SSR Node server and a FastAPI service. The database stays on Neon.

## Approach

Containerize both services (Dockerfiles already exist) and deploy each as its own
Cloud Run service, scaling to zero. Keep the DB on Neon (reuse the proven
`DATABASE_URL`). Serve the custom domain via Cloud Run's built-in domain mapping
(Google-managed TLS, free) — Cloudflare is a fallback, not required here.

| Piece | Host | Notes |
|---|---|---|
| PostgreSQL | **Neon** (existing project) | No migration. Reuse proven `DATABASE_URL`. |
| FastAPI backend | **Cloud Run** service `l7-backend` | From `backend/Dockerfile`. Scales to zero. |
| React Router v7 SSR frontend | **Cloud Run** service `l7-frontend` | From `frontend/Dockerfile`. Scales to zero. |
| Custom domain HTTPS | **Cloud Run domain mapping** (or Cloudflare) | Google-managed cert, free. |

### Key decisions

- **Backend must listen on `$PORT`.** Cloud Run sets `PORT` (default 8080) and
  routes to it; the current backend Dockerfile hardcodes `--port 8000`. Fix the
  `CMD` to respect `$PORT` (shell form) so it works both locally and on Cloud Run.
  Alternative (no code change) is to deploy with `--port 8000`, but respecting
  `$PORT` is the standard, portable fix.
- **Frontend needs no change.** `react-router-serve` reads `PORT` automatically,
  so it binds to Cloud Run's injected port as-is.
- **Scale to zero stays free.** Default `min-instances=0` + default CPU throttling
  (CPU allocated only during request processing) keeps usage inside the free tier;
  set a low `max-instances` (e.g. 2–4) as a cost guardrail. Cold starts are
  handled transparently by Cloud Run — an incoming request is queued until the
  container is ready (a few seconds, no holding page), so no wake feature is
  needed. (The Render-era browser-driven wake was removed as part of this move.)
- **Secrets via Secret Manager.** Store `DATABASE_URL`, `GOOGLE_CLIENT_SECRET`,
  `JWT_SECRET` in Secret Manager and inject with `--set-secrets`; non-secret
  config (`ENVIRONMENT`, URLs, `GOOGLE_CLIENT_ID`) via `--set-env-vars`.
- **Migrations are a no-op now** (Neon already at head). For future deploys, run
  `alembic upgrade head` as a **Cloud Run Job** (or a one-off local run against
  Neon) — never at container startup, which would re-run on every cold start and
  can race across instances.
- **Region near Neon.** Pick the Cloud Run region closest to the Neon DB to
  minimize SSR→backend→DB latency (Render ran in Oregon; if Neon is Oregon/us-west,
  use `us-west1`). Free tier is identical across Tier-1 regions.

## Steps (walkthrough)

1. **GCP account setup:** create a project; enable billing (card required, no
   charge within free quota); enable APIs `run`, `cloudbuild`, `artifactregistry`,
   `secretmanager`. Install + auth the `gcloud` CLI.
2. **Fix backend `CMD`** to respect `$PORT` (only repo code change).
3. **Create secrets** in Secret Manager (`DATABASE_URL`, `GOOGLE_CLIENT_SECRET`,
   `JWT_SECRET`).
4. **Deploy backend** from `backend/` (`gcloud run deploy --source`), env +
   secrets set, `--allow-unauthenticated`. Note its `*.run.app` URL.
5. **Deploy frontend** from `frontend/`, setting `BACKEND_URL` to the backend URL,
   plus `GOOGLE_CLIENT_ID`, `GOOGLE_REDIRECT_URI`, `NODE_ENV=production`. Note its
   `*.run.app` URL; set the backend's `FRONTEND_URL` to it and redeploy backend.
6. **Custom domain:** map `ledgersub7.raistlanschade.com` to the frontend service
   (Cloud Run domain mapping + DNS records + verification), or front with
   Cloudflare pointing at the frontend `*.run.app`.
7. **Google OAuth console:** ensure redirect URI
   `https://ledgersub7.raistlanschade.com/auth/callback` (and the `*.run.app`
   frontend URL for testing) are authorized. Remove old Render URLs after cutover.
8. **Smoke test:** load via custom domain, Google sign-in, confirm existing data
   loads (proves Neon connectivity), add/edit/delete an entry, weekly report,
   and a cold-start load (request should queue a few seconds, then render).

## Files affected

- `docs/plans/2026-07-26-deploy-cloudrun-migration.md` (this file).
- `backend/Dockerfile` — change `CMD` to respect `$PORT`. **To apply after
  approval.**
- `backend/.dockerignore` — currently empty; add `.venv`, `__pycache__`, `.env`,
  `tests`, `*.pyc` to shrink build context (optional).
- Optional `cloudbuild.yaml` / deploy script if we want repeatable one-command
  deploys (can add later).
- `render.yaml` — leave until Cloud Run is verified live, then remove in a
  follow-up.
- `CLAUDE.md` Deployment line — update to Cloud Run + Neon (currently stale).
- No application code changes expected beyond the Dockerfile `CMD`.

## Open questions / verify during execution

- **Neon region** — confirm to choose the matching Cloud Run region.
- **Neon pooled vs direct / asyncpg + PgBouncer** — if prepared-statement errors
  appear, append `statement_cache_size=0` or use the direct endpoint (same caveat
  as prior migrations).
- **Cold-start budget** — verify the SSR frontend cold start is acceptable; if
  not, a small `min-instances=1` would end free-tier eligibility, so keep at 0.
- **Domain mapping availability** — confirm Cloud Run domain mapping is GA in the
  chosen region; else use Cloudflare.

## Acceptance criteria

- Both Cloud Run services build (from their Dockerfiles) and serve on `*.run.app`.
- `https://ledgersub7.raistlanschade.com` serves the frontend over HTTPS at $0.
- Google sign-in works end-to-end; pre-existing Neon data is visible.
- Create/edit/delete entry and the weekly report function.
- Cold starts are handled transparently by Cloud Run request queuing (a few
  seconds, no holding page) — no wake feature required.
- Monthly usage stays within the Cloud Run always-free allowances.
