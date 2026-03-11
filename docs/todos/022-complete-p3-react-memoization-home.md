---
status: pending
priority: p3
issue_id: "022"
tags: [frontend, performance, react]
dependencies: []
---

# Missing memoization for entriesWithLabels and PipBar causes keypad re-renders

## Problem Statement

Every keypad key press triggers `setDisplay`, causing `HomePage` to re-render. On each render:
1. `entriesWithLabels` creates 50 `Date` objects and calls `formatDayLabel` 50 times
2. `PipBar` allocates a new 20-element array and re-renders 20 pip divs

Both are pure derivations of data that doesn't change on keypad input.

## Findings

- `frontend/app/routes/home.tsx:150-156` — `entriesWithLabels` not memoized
- `frontend/app/components/PipBar.tsx:21` — `Array.from({length:20})` not memoized, component not memo'd

## Proposed Solutions

### Option A — useMemo + React.memo (Recommended)
```typescript
// home.tsx
const entriesWithLabels = useMemo(() =>
  entries.map(e => ({ ...e, dayLabel: formatDayLabel(new Date(e.date + "T12:00:00")) })),
  [entries]
);

// PipBar.tsx
export const PipBar = React.memo(function PipBar({ percentage, overBudget }: PipBarProps) {
  // same body
});
```

## Recommended Action

Option A.

## Acceptance Criteria

- [ ] `entriesWithLabels` wrapped in `useMemo([entries])`
- [ ] `PipBar` wrapped in `React.memo`
- [ ] No visual or behavioral change

## Work Log

- 2026-03-09: Found by performance-oracle during ce:review
