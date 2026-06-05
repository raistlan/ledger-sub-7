# Plan: Tolerate backend cold starts in the SSR API client

**Date:** 2026-06-04
**Type:** fix

## Problem statement

The backend (`l7-backend`) runs on Render's free plan, which spins the service
down after a period of inactivity (confirmed by a clean SIGTERM shutdown in the
backend logs: `Shutting down` → `Application shutdown complete` → `Finished
server process`). When a user then visits the frontend, the SSR loader in
`home.tsx` (and other routes) calls the backend via `ApiClient`. While the
backend is cold, Render returns a fast `502` (its styled error page) to the
in-flight request instead of holding the connection open for the ~30–60s
spin-up.

`ApiClient.request` (`frontend/app/lib/api.server.ts`) treats *any* non-OK
response as fatal — it immediately `throw`s the upstream body as a `Response`.
So a transient cold-start `502` becomes a hard error page for the user
("ERROR 502 — An unexpected error occurred"), and the giant base64 font blob
from Render's 502 page gets dumped into our logs.

This is graceful-degradation missing from the read path. The real availability
fix is to keep the backend warm (external uptime ping every ~10 min), but the
client must also survive an occasional cold start.

## Approach

Add a small `fetchWithWake` helper in `api.server.ts` that wraps `fetch` and
retries on conditions that indicate "backend not ready yet":

- Response status in `{502, 503, 504}` (gateway/spin-up errors — these come
  from Render's edge *before* the request reaches the app, so retrying is safe
  even for non-idempotent methods).
- `fetch` throwing (network/connection error).

Retry with capped exponential backoff so the total wait (~45s) bridges a
typical free-tier cold start, then give up and return/throw as today so the
existing `ErrorBoundary` still handles a genuinely-down backend.

`ApiClient.request` switches from `fetch(...)` to `fetchWithWake(...)`; all
other behaviour (401 → redirect Response, error envelope passthrough, `.data`
unwrap) is unchanged.

Key decisions:
- Retry parameters are arguments with sensible defaults so tests can pass
  `baseDelayMs: 0` and run fast with no real timers.
- `fetchWithWake` depends only on `res.status`, so tests can use minimal fetch
  stubs without a real `Response`.
- This is the in-app safety net only. Keeping the backend warm (external
  pinger on `/api/v1/health`) is the primary fix and is documented separately,
  not code in this change.

## Files affected

- `frontend/app/lib/api.server.ts` — add `fetchWithWake`, use it in `request`.
- `frontend/app/lib/api.server.test.ts` — tests for retry/backoff behaviour.

## Acceptance criteria

- `fetchWithWake` returns immediately on a first successful response.
- It does **not** retry a non-gateway error (e.g. 401, 400, 404).
- It retries on 502/503/504 and resolves once a later attempt succeeds.
- It retries on a thrown fetch error and resolves once a later attempt succeeds.
- After exhausting retries it returns the last gateway response (so `request`
  still throws the upstream error) / rethrows the last network error.
- `ApiClient` success and 401 paths are unchanged.
- `npm test` passes; `npm run typecheck` passes.
