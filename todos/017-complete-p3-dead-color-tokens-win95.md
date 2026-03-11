---
status: pending
priority: p3
issue_id: "017"
tags: [frontend, cleanup, dead-code]
dependencies: []
---

# Dead color tokens in win95.ts never used anywhere

## Problem Statement

Three color tokens in `win95.ts` are defined but never referenced in any component or utility:
- `C.surfaceHover: "#282828"` (speculative hover state)
- `C.cyanDark: "#009999"` (secondary accent)
- `C.titleBarBright: "#1818aa"` (alternate title bar gradient)

## Findings

- `frontend/app/utils/win95.ts:8,16,18` — three unused color entries

## Proposed Solutions

### Option A — Delete the 3 entries
3 LOC removed, theme object documents only what is in use.

## Recommended Action

Option A.

## Acceptance Criteria

- [ ] 3 dead color tokens removed
- [ ] No compilation errors

## Work Log

- 2026-03-09: Found by code-simplicity-reviewer during ce:review
