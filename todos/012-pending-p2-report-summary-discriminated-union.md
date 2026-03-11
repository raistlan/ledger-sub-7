---
status: pending
priority: p2
issue_id: "012"
tags: [frontend, typescript, type-safety]
dependencies: []
---

# `ReportSummary` optional fields should be a discriminated union

## Problem Statement

`ReportSummary` in `types/api.ts` has both `entries?: ReportEntry[]` and `weeks?: WeekSummary[]`
as optional. A `ReportSummary` with neither field is valid per the type. In `reports.tsx`,
if both are absent, the render silently produces an empty screen with no user feedback.
The backend always returns exactly one of the two, but the type doesn't encode this invariant.

## Findings

- `frontend/app/types/api.ts:70-78` — both fields optional
- `frontend/app/routes/reports.tsx:245-277` — render branches on `activeSummary.weeks ? ... : activeSummary.entries?.map(...)`

## Proposed Solutions

### Option A — Discriminated union (Recommended)
```typescript
export type ReportSummary =
  | {
      mode: "flat";
      total_spent: number;
      total_credits: number;
      net: number;
      entries: ReportEntry[];
      weeks?: never;
    }
  | {
      mode: "grouped";
      total_spent: number;
      total_credits: number;
      net: number;
      weeks: WeekSummary[];
      entries?: never;
    };
```
Also update backend to include `mode` field in response.

### Option B — Keep optional fields but add exhaustive type guard
Narrower change but less type-safe.

## Recommended Action

Option A if backend can be updated together; Option B as a frontend-only fix.

## Technical Details

- Files: `frontend/app/types/api.ts`, `backend/app/routers/reports.py`

## Acceptance Criteria

- [ ] TypeScript exhaustively narrows `ReportSummary` render
- [ ] Empty-state case (neither field) either impossible by type or shows error message

## Work Log

- 2026-03-09: Found by kieran-typescript-reviewer and architecture-strategist during ce:review
