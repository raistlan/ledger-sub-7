---
status: pending
priority: p2
issue_id: "007"
tags: [security, backend, dos]
dependencies: []
---

# Unbounded pagination parameters in GET /entries

## Problem Statement

The `list_entries` endpoint accepts `limit` and `offset` with no upper bound. An authenticated
user can send `?limit=10000000` causing the ORM to fetch all their rows in a single trip,
exhausting memory and CPU. This is a resource-exhaustion DoS vector available to any
authenticated user.

## Findings

- `backend/app/routers/entries.py:40-41` — `limit: int = 100, offset: int = 0`
- No `Query(ge=1, le=500)` constraint present

## Proposed Solutions

### Option A — FastAPI Query constraints (Recommended)
```python
from fastapi import Query

async def list_entries(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    ...
):
```

## Recommended Action

Option A — one-line change per parameter.

## Technical Details

- File: `backend/app/routers/entries.py:40-41`

## Acceptance Criteria

- [ ] `limit` capped at 500, minimum 1
- [ ] `offset` minimum 0
- [ ] Requests with `limit=0` or `limit=1000000` return 422

## Work Log

- 2026-03-09: Found by security-sentinel during ce:review
