---
status: pending
priority: p2
issue_id: "011"
tags: [frontend, typescript, type-safety]
dependencies: []
---

# `startDay as 0` incorrectly narrows WeekStartDay union in reports.tsx

## Problem Statement

`reports.tsx:41,49` casts `startDay as 0` when calling `getWeekStart`. `WeekStartDay` is
`0 | 1 | 2 | 3 | 4 | 5 | 6` and `startDay` is already correctly typed as `WeekStartDay`.
The `as 0` cast lies to TypeScript — it narrows the union to only `0` which is wrong for
users with non-Sunday week starts. The code works at runtime due to arithmetic use, but
TypeScript is being misinformed.

## Findings

- `frontend/app/routes/reports.tsx:41` — `getWeekStart(today, startDay as 0)`
- `frontend/app/routes/reports.tsx:49` — same pattern

## Proposed Solutions

### Option A — Fix the parameter types of computeRange (Recommended)
```typescript
function computeRange(preset: string, today: Date, startDay: WeekStartDay) {
  // ...
  const weekStart = getWeekStart(today, startDay);
  // no cast needed — types already compatible
}
```
Ensure `getWeekStart` parameter type is `WeekStartDay`, not `0`.

## Recommended Action

Option A — remove the `as 0` casts, fix the function signature.

## Technical Details

- File: `frontend/app/routes/reports.tsx:41,49`
- Also check `getWeekStart` signature in `frontend/app/utils/weeks.ts`

## Acceptance Criteria

- [ ] `as 0` casts removed from `reports.tsx`
- [ ] TypeScript compiles without errors
- [ ] `getWeekStart` accepts `WeekStartDay` type parameter

## Work Log

- 2026-03-09: Found by kieran-typescript-reviewer during ce:review
