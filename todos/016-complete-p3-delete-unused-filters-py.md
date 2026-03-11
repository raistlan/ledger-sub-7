---
status: pending
priority: p3
issue_id: "016"
tags: [backend, cleanup, dead-code]
dependencies: []
---

# `filters.py` is entirely unused — delete it

## Problem Statement

`backend/app/utils/filters.py` defines `apply_entry_filters` with a generic ORM filter DSL
(frozenset allowlist + operator map), but no caller exists anywhere in the codebase.
`list_entries` writes its two filter conditions inline, which is the correct approach at
this complexity level. This is a YAGNI violation: a reusable abstraction with no caller.

## Findings

- `backend/app/utils/filters.py` — 26 lines, 0 callers
- `backend/app/routers/entries.py` — inline filters, never imports filters.py

## Proposed Solutions

### Option A — Delete the file
26 LOC removed, zero behavior change.

## Recommended Action

Option A.

## Technical Details

- File: `backend/app/utils/filters.py`

## Acceptance Criteria

- [ ] `filters.py` deleted
- [ ] No import errors
- [ ] Tests still pass

## Work Log

- 2026-03-09: Found by code-simplicity-reviewer during ce:review
