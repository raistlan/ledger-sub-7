---
status: pending
priority: p3
issue_id: "018"
tags: [backend, validation, api]
dependencies: []
---

# `group_by` query parameter has no allowlist validation

## Problem Statement

`reports.py:22` accepts `group_by: str | None = None` with no validation. Any string other
than `"week"` silently falls through to the ungrouped path, returning a 200 with unexpected
data instead of a 400 error. The pattern is fragile for future maintenance.

## Findings

- `backend/app/routers/reports.py:22` — `group_by: str | None = None`
- `backend/app/routers/reports.py:53` — `if group_by == "week":`

## Proposed Solutions

### Option A — Explicit allowlist check (Recommended)
```python
if group_by not in (None, "week"):
    raise HTTPException(status_code=400, detail="group_by must be 'week' or omitted")
```

### Option B — Literal type
```python
from typing import Literal
group_by: Literal["week"] | None = None
```
FastAPI will return 422 automatically for invalid values.

## Recommended Action

Option B — cleaner, more idiomatic FastAPI.

## Acceptance Criteria

- [ ] `group_by=invalid` returns 422 or 400
- [ ] `group_by=week` still works
- [ ] `group_by` omitted still works

## Work Log

- 2026-03-09: Found by security-sentinel during ce:review
