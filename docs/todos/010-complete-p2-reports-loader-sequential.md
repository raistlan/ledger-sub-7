---
status: pending
priority: p2
issue_id: "010"
tags: [performance, frontend, ssr]
dependencies: []
---

# Reports SSR loader makes sequential API calls instead of parallel

## Problem Statement

`reports.tsx` loader calls `api.get("/auth/me")` and awaits it before fetching the report
summary. When explicit `start`/`end` params are in the URL (as they always are after first
load via `handleRangeChange`), the user data is fetched first unnecessarily, adding 5-20ms
of avoidable sequential latency on every page load. `home.tsx` correctly uses `Promise.all`
for its parallel fetches.

## Findings

- `frontend/app/routes/reports.tsx:21-33` — sequential: await me, then await summary
- `frontend/app/routes/home.tsx:26-29` — correct parallel pattern: `Promise.all([entries, budget])`

## Proposed Solutions

### Option A — Parallel when start/end params present (Recommended)
```typescript
const params = new URL(request.url).searchParams;
const hasExplicitRange = params.has("start") && params.has("end");

if (hasExplicitRange) {
  const [meResult, summaryResult] = await Promise.all([
    api.get<User>("/auth/me"),
    api.get<ReportSummary>(`/reports/summary?${params}`),
  ]);
  // ...
} else {
  // sequential: need me first to compute default range
  const meResult = await api.get<User>("/auth/me");
  // compute range from week_start_day, then fetch summary
}
```

## Recommended Action

Option A — parallel fetch when range params are already known.

## Technical Details

- File: `frontend/app/routes/reports.tsx:21-33`

## Acceptance Criteria

- [ ] When `start` and `end` params present, both API calls fire concurrently
- [ ] SSR response time improves by ~one network round-trip

## Work Log

- 2026-03-09: Found by performance-oracle during ce:review
