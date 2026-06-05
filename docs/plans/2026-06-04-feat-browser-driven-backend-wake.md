# Plan: Browser-driven backend wake for Render free-tier cold starts

**Date:** 2026-06-04
**Type:** feat
**Supersedes (partly):** `2026-06-04-fix-frontend-backend-coldstart-retry.md` — the
server-side retry stays only as a short fail-fast guard; the real cold-start UX
moves to the browser.

## Problem statement

`l7-backend` runs on Render's free plan, which spins the service down after 15
minutes of no inbound traffic; the cold start back up takes ~50s. Render's
*graceful* cold-start handling (a loading page that the client waits on /
auto-retries) is **browser-oriented** — it assumes a browser hits the service
directly. In our split architecture the browser hits the **frontend**, and the
frontend's **server-to-server** API fetch is what hits the cold backend. That
non-browser call gets a hard **502** instead of being ridden out, so the user
sees the generic `ERROR 502` page (`root.tsx` ErrorBoundary).

Evidence gathered:
- A single sustained request (`curl` to `/api/v1/health`, Accept `*/*`) was
  **held open for 53s** by Render and returned `200` once the backend booted —
  i.e. staying connected through the boot is what completes the wake.
- The frontend's loader **bails in ~200ms** on the first 502 (one of its
  parallel `Promise.all` calls fails fast), never staying connected long enough
  to ride out the spin-up. Backend logs confirm the frontend's visits triggered
  **no boot** (a 16-minute gap between the last frontend 502 and the boot my
  curl caused).
- Render's free wake trigger is additionally flaky (community-confirmed mid-2025
  regression: POST requests stopped waking services; only GET reliably does).
  The only *officially supported* fix is a paid instance — but we want a free,
  graceful path.

## Approach

Let the **browser** drive the wake (replicating the curl that worked), and turn
the failure into a themed "waking the server" experience instead of an error:

1. A cold backend makes any route loader throw `502` (already happens). The
   route ErrorBoundary rethrows non-401s; the **root `ErrorBoundary`** is the
   single choke point.
2. In the root ErrorBoundary, branch on `isRouteErrorResponse(error) &&
   [502,503,504].includes(error.status)` → render a new `<BackendWaking />`
   component instead of the generic error panel.
3. `<BackendWaking />` uses a new `useWakeBackend()` hook with **two parts**:
   - **Wake driver:** issue long-timeout (`AbortController` ~60s)
     `fetch(\`${BACKEND_URL}/api/v1/health\`, { mode: "no-cors", cache:
     "no-store" })` straight from the browser, back-to-back, to keep a
     connection open driving the boot (same shape as the curl that held 53s).
     `mode: "no-cors"` means we can't *read* the response — and we don't need to;
     it sidesteps the CORS mismatch (see below) while still hitting Render's edge
     to trigger/sustain the wake.
   - **Readiness signal:** every ~3s call `useRevalidator().revalidate()`, which
     re-runs the SSR loaders server-side (where CORS doesn't apply). While the
     backend is cold those revalidations 502 and we stay on the waking screen;
     once it's warm, the loader succeeds, React Router replaces the root error
     boundary with the real route, and `<BackendWaking />` unmounts (its effects
     clean up the pings/intervals). Revalidation succeeding *is* the "backend is
     warm" signal — no need to read `/health` cross-origin.

   Meanwhile the user sees a Win95 "waking the server…" screen with progress.

### Key decisions

1. **Wake from the browser, not the SSR server.** A held browser `fetch`
   behaves like the curl that succeeded (Render holds the connection through the
   boot), and it lets us show progress rather than blocking SSR for ~55s (which
   also risks the frontend's ~100s Cloudflare edge timeout and ties up the Node
   server).
2. **Inline the backend's public base URL at build time.** Vite `define`
   replaces a `__BACKEND_URL__` constant with `JSON.stringify(process.env.BACKEND_URL)`
   (vite.config.ts), reusing the `BACKEND_URL` the frontend service already has —
   no new env var, no runtime `window.ENV` plumbing. `clientEnv.getBackendUrl()`
   reads the constant (guarded with `typeof` so Jest, which has no `define`, sees
   it undefined). Chosen over `import.meta.env.VITE_*` because `import.meta` is a
   compile error under our `ts-jest` CommonJS config and `clientEnv` is imported
   by the hook test. (Trade-off: changing the backend URL needs a rebuild — fine,
   it's stable.)
3. **Reuse `/api/v1/health` as the wake endpoint** — unauthenticated, so the
   browser request needs no cookies/credentials.
4. **Fix CORS via an env change only (chosen).** Today the browser origin is the
   custom domain `https://ledgersub7.raistlanschade.com`, but the backend allows
   only `FRONTEND_URL` = `https://l7-frontend.onrender.com`, so a readable
   cross-origin fetch would be blocked. `FRONTEND_URL` is used *only* for CORS
   (`main.py:26`), so we simply **set `FRONTEND_URL=https://ledgersub7.raistlanschade.com`**
   on the backend service — no code change. (Browser-wake is a production-only
   concern — free-tier spin-down doesn't happen in local dev — so a single origin
   is enough; no list needed.) *Fallback if CORS is left as-is:* fire the wake
   ping with `mode:"no-cors"` and detect readiness via revalidation only.
5. **Readiness = a real JSON `200` (`{status:"ok"}`) read from `/health`**, then
   `revalidate()` once to re-render. (Fallback w/o CORS fix: readiness = a
   successful `revalidate()`, since SSR bypasses CORS.) Treat fetch rejections /
   non-JSON / non-200 as "still waking; keep waiting."
6. **Wake driver — back-to-back long-timeout fetches** (`AbortController` ~60s)
   to keep a connection open through the ~53s boot (mirroring the held curl),
   rather than one short ping that could disconnect before the boot completes.
   Overall deadline ~120s, then a "still waking — retry" button.
7. **No server-side retry.** `ApiClient.request` uses a plain `fetch`, so a cold
   backend surfaces as a 502 immediately and hands off to the browser wake. (An
   earlier `fetchWithWake` retry helper was removed — it added little once the
   browser wake handles cold starts, and a transient blip is covered by the
   wake + revalidate path anyway.)
8. **Recovery on success:** `useRevalidator().revalidate()`; if the root error
   state doesn't clear cleanly, fall back to `window.location.reload()`.

## Files affected

- `frontend/app/root.tsx` — branch `ErrorBoundary` to `<BackendWaking />` on
  502/503/504.
- `frontend/vite.config.ts` — `define: { __BACKEND_URL__: ... }` to inline the
  backend origin at build.
- `frontend/app/components/BackendWaking.tsx` *(new)* — Win95 "waking server"
  screen + progress; consumes the hook.
- `frontend/app/hooks/useWakeBackend.ts` *(new)* — long-timeout fetch (and/or
  poll), readiness detection, revalidate-on-success. + `useWakeBackend.test.ts`.
- `frontend/app/lib/clientEnv.ts` *(new, small)* — `getBackendUrl()` reading the
  build-time `__BACKEND_URL__` constant.
- `frontend/app/lib/api.server.ts` — `request()` uses a plain `fetch` (removed
  the `fetchWithWake` retry helper); update `api.server.test.ts`.
- `backend` — **env-only:** set `FRONTEND_URL=https://ledgersub7.raistlanschade.com`
  on the backend service (no code change).
- `docs/plans/2026-06-04-feat-browser-driven-backend-wake.md` — this file.

## Testing plan ("test and shift")

- **Unit (Jest):**
  - `useWakeBackend`: mock `fetch` → reject then JSON 200 ⇒ calls `revalidate`;
    respects the timeout/deadline; treats non-JSON / non-200 / rejection as
    not-ready and keeps trying; stops at the deadline.
  - `fetchWithWake`: reduced budget still passes existing retry semantics.
- **Manual / integration (the decisive test):** let the backend spin down
  (~15 min idle), load the frontend, and confirm the sequence:
  SSR fails fast → waking screen appears → the **browser's** health request
  shows up in backend logs as the boot trigger → ~53s later a JSON 200 →
  revalidate → real page renders, no manual refresh.
  - This validates the held-vs-loading-page assumption (decision 6). If Render
    returns a loading page early rather than holding, switch the hook to poll
    mode.
  - Confirm the cross-origin GET to `/health` succeeds with no CORS error when
    warm (decision 4).

## Acceptance criteria

- Cold backend → user sees the themed "waking the server" screen, never the raw
  `ERROR 502` page.
- The browser's wake request is the entry in backend logs that boots it.
- Within ~60–90s the page auto-recovers and renders real data with no manual
  refresh.
- Warm-backend path is unchanged: no extra latency, no wake screen, no CORS
  errors.
- `npm test` and `npm run typecheck` pass.

## Open questions (resolve by testing, not assumption)

1. Does Render **hold** the browser fetch through the boot (single long request
   works) or return a **loading page early** (need poll mode)?
2. Does `revalidate()` cleanly clear the root ErrorBoundary, or is a full
   `location.reload()` required?

*(Resolved: CORS — `FRONTEND_URL` will be set to the custom domain, prod-only, single
origin, env change only.)*
