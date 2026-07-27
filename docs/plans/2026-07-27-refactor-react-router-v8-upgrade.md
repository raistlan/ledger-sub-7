# React Router v7 → v8 Upgrade

**Date:** 2026-07-27
**Type:** refactor
**Status:** complete — pending manual smoke test (branch `chore/react-router-v8`)

---

## Problem Statement

The frontend runs React Router 7.18.1 (just bumped from 7.12.0 to clear 12 of 13
security advisories). One advisory remains open:

- **GHSA-qwww-vcr4-c8h2** — RSC Mode CSRF Bypass Allows Action Execution Before
  400 Response. Vulnerable range `7.12.0 - 8.2.0`, fixed in **8.3.0**.

This app runs framework mode with SSR, not RSC, so the vulnerable path is not
reachable today. The upgrade is therefore **not urgent on security grounds** —
the real drivers are:

1. Staying on a supported major before the v7 line stops receiving fixes.
2. Clearing the five `v8_*` future-flag warnings now printed on every build.
3. Doing the migration while the surface area is genuinely small (see below).

## Migration Surface — Findings

A survey of `frontend/app/` shows most v8 breaking changes **do not apply**:

| Breaking change | Applies? | Notes |
|---|---|---|
| `react-router-dom` package removed | ❌ No | Zero imports; not a dependency |
| `meta`/`useMatches` `data` → `loaderData` | ❌ No | All 4 `meta()` exports take **no arguments** |
| `useMatches()` `.data` | ❌ No | `useMatches` never used |
| Cloudflare dev proxy removed | ❌ No | Not used |
| Architect `useRequestContextDomainName` | ❌ No | Not used |
| `getLoadContext` / `AppLoadContext` | ❌ No | No custom server; uses `react-router-serve` |
| `isSsrBuild` in vite config | ❌ No | `vite.config.ts` has no build-mode branching |
| **`v8_passThroughRequests` URL handling** | ✅ **Yes** | 4 sites — the only real work |

### Version prerequisites — all already met

| Requirement | Required | Installed |
|---|---|---|
| Node.js | 22.22+ | 24.13.0 ✅ |
| React / React-DOM | 19.2.7+ | 19.2.8 ✅ |
| Vite | 7+ | 7.3.6 ✅ |

### The four `new URL(request.url)` sites

Under `v8_passThroughRequests`, `request` becomes the **raw** HTTP request. The
`.data` suffix and React Router's internal search-param normalization are no
longer stripped. Loaders must read the new `url` loader argument for normalized
routing logic, reserving `request.url` for genuinely raw concerns.

| File | Line | Current use | Risk if unmigrated |
|---|---|---|---|
| `app/routes/reports.tsx` | 20 | `new URL(request.url).searchParams`, then **`params.toString()` forwarded verbatim to the backend** | **Highest.** Raw request may carry RR-internal params; those would be proxied into `/reports/summary?…` and could confuse or error the backend |
| `app/routes/home.tsx` | 48 | `url.pathname` → builds `?redirectTo=` on 401 | On a data request the pathname carries a `.data` suffix, producing a broken post-login redirect target |
| `app/routes/login.tsx` | 8 | `searchParams` for `redirectTo` / `error` | Params could arrive un-normalized |
| `app/routes/auth.callback.tsx` | 9 | `searchParams` for OAuth `code` / `state` | Lowest — always a document request from Google's redirect, never a data request. Migrate for consistency |

Note: `auth.callback.tsx` types its loader with a hand-imported
`LoaderFunctionArgs` rather than the generated `Route.LoaderArgs`. It should be
switched to the generated type so the new `url` argument is typed.

## Approach

Follow the official guidance: **adopt each future flag on v7.18.1 first, one
commit per flag, then flip the major.** This keeps every step independently
verifiable and bisectable (ADR-011), and means a regression points at one flag
rather than the whole major.

**Step 1 — `v8_middleware`**
Config-only. No custom server, so no `getLoadContext` migration needed.

**Step 2 — `v8_splitRouteModules`**
Config-only, pure build optimization. Adopt as `true` (not `"enforce"`).

**Step 3 — `v8_viteEnvironmentApi`**
Config-only. `vite.config.ts` has no `isSsrBuild` branching to migrate.

**Step 4 — `v8_passThroughRequests`** ← the only code-change step
Migrate all four sites from `request.url` to the `url` loader argument, and
switch `auth.callback.tsx` to the generated `Route.LoaderArgs` type.

**Step 5 — `v8_trailingSlashAwareDataRequests`**
Config-only. Data request URLs change to the `/_.data` form. Nothing in this
repo rewrites or caches data URLs (no CDN rules, no custom server), and the
Vite dev proxy only matches `/api`, so no rewrite logic needs updating.

**Step 6 — bump to v8**
`react-router`, `@react-router/node`, `@react-router/serve`, `@react-router/dev`
→ `8.3.0` (pinned exact, matching current convention). Remove the now-default
future flags from `react-router.config.ts`.

## Files Affected

| File | Change |
|---|---|
| `frontend/react-router.config.ts` | Add `future` flags across steps 1–5; strip them in step 6 |
| `frontend/app/routes/reports.tsx` | `request.url` → `url` loader arg |
| `frontend/app/routes/home.tsx` | `request.url` → `url` loader arg |
| `frontend/app/routes/login.tsx` | `request.url` → `url` loader arg |
| `frontend/app/routes/auth.callback.tsx` | `request.url` → `url`; `LoaderFunctionArgs` → generated `Route.LoaderArgs` |
| `frontend/package.json` | Four `@react-router/*` + `react-router` → `8.3.0` |
| `frontend/package-lock.json` | Regenerated |

No backend changes. No database changes. Rule 4 (build back-to-front) is not
engaged — this is a frontend-only dependency migration with no new API surface.

## Testing

Per rule 2, the URL-handling change is behaviour worth pinning down before it
moves. The current loaders have no direct tests.

- Extract the redirect-target construction in `home.tsx` into a small pure
  helper in `app/utils/` and unit-test it, rather than trying to test the loader
  whole. Write the test first, against current behaviour, so the flag flip must
  keep it green.
- `reports.tsx` param forwarding: add a test for the param-selection logic,
  extracting it to a pure helper if that is what it takes to make it testable.
- Existing suite (7 suites / 75 tests) must stay green at every step.

## Acceptance Criteria

- [x] `npm run typecheck` passes at each step
- [x] `npm test` passes at each step; new helper tests included
      (7 suites / 75 tests → 9 suites / 89 tests)
- [x] `npm run build` passes with **zero** `Future Flag Warning` lines
- [x] `npm audit` reports **no** `react-router` advisories
- [ ] Manual smoke test against a running backend: Google login round-trip,
      logging an expense, the reports screen with an explicit date range, and a
      401 → login redirect preserving `redirectTo` — **owner: user**
- [x] One commit per step, each independently green

## Outcome Notes

- **Flag warnings collapsed early.** After adopting `v8_passThroughRequests` the
  build dropped to zero warnings, before `v8_trailingSlashAwareDataRequests` was
  set — the latter's warning appears to be subsumed by the former. The flag was
  still adopted explicitly, and `satisfies Config` accepted it, so it is a real
  key and the semantics were opted into deliberately rather than by default.
- **npm resolver deadlock, twice.** Both the 7.18.1 and 8.3.0 bumps failed with
  `ERESOLVE` against the stale pinned lockfile entries, even with an explicit
  `npm install <pkg>@<version>` and after clearing `node_modules/@react-router`.
  Both needed `rm -rf node_modules package-lock.json` and a full reinstall. Worth
  expecting on the next pinned-dependency major.
- **Boot check beyond the build.** `npm start` was run against the v8 build and
  `GET /login` returned 200 with SSR markup, confirming `@react-router/serve` v8
  boots and renders. This does not replace the backend-dependent smoke test.
- **Remaining audit findings:** 20 high, all in the `jest` / `brace-expansion`
  dev chain. Untouched on purpose — dev-only, and the only published fix is
  `brace-expansion` 5.0.8 with no backport to the installed 1.x/2.x lines.
