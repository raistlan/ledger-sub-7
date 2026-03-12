# Plan: Fix Reports & Home Date Timezone Bug (Centralized Approach)

## Problem

The server (Node.js in WSL2) runs UTC. Users in timezones behind UTC experience the server treating "today" as the next calendar day when it's late evening locally. This causes incorrect week ranges on home and reports pages.

## Solution

Session cookie + `useLocalToday` hook:

1. **`useLocalToday` hook** — single source of truth for client-side date computation
2. **Session cookie set in `root.tsx`** — makes local date available to ALL server loaders automatically; refreshed on mount and on tab visibility change (`visibilitychange` event)

The cookie approach is necessary because cookies are the only mechanism automatically forwarded to server-side loaders.

## Files Changed

| File | Change |
|------|--------|
| `frontend/app/hooks/useLocalToday.ts` | **New** — reusable hook |
| `frontend/app/hooks/useLocalToday.test.ts` | **New** — hook tests |
| `frontend/app/lib/api.server.ts` | Added `getLocalDateFromCookie` export |
| `frontend/app/lib/api.server.test.ts` | **New** — tests for `getLocalDateFromCookie` |
| `frontend/app/utils/weeks.test.ts` | Added `toISODate` test cases |
| `frontend/app/root.tsx` | Added `useEffect` in `App()` for cookie set + visibility refresh |
| `frontend/app/routes/home.tsx` | Loader uses cookie; component uses hook |
| `frontend/app/routes/reports.tsx` | Loader uses cookie; component uses hook |

## Cookie Details

- No `Max-Age` (session cookie) — cleared on browser close; refreshed on every mount
- `visibilitychange` listener handles tabs left open past midnight
- `SameSite=Lax` — standard security attribute
- Strictly necessary cookie; no consent banner required under GDPR/CCPA
