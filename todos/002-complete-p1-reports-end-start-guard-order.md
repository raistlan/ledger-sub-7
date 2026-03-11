---
status: pending
priority: p1
issue_id: "002"
tags: [correctness, backend, reports]
dependencies: []
---

# `end < start` date guard evaluated after `(end - start).days` in reports.py

## Problem Statement

In `reports.py`, the check `if (end - start).days > MAX_DATE_RANGE_DAYS` runs BEFORE the
`if end < start` validation. When `end < start`, `(end - start).days` is negative, so the
range check silently passes and the correct 400 error is never raised. Users sending
`end < start` receive incorrect data instead of an error.

## Findings

- `backend/app/routers/reports.py:27-33` — range check precedes end>=start validation
- When `end < start`, `(end - start).days` is negative → range check passes silently
- The `end < start` guard on line ~31 is never reached for this case

## Proposed Solutions

### Option A — Swap guard order (Recommended)
```python
if end < start:
    raise HTTPException(status_code=400, detail="end must be >= start")
if (end - start).days > MAX_DATE_RANGE_DAYS:
    raise HTTPException(status_code=400, detail=f"Date range exceeds {MAX_DATE_RANGE_DAYS} days")
```
Pros: Correct, trivial change. Cons: None.

## Recommended Action

Option A — swap the two if-blocks.

## Technical Details

- File: `backend/app/routers/reports.py:27-33`

## Acceptance Criteria

- [ ] `end < start` raises 400 "end must be >= start"
- [ ] Excessive range still raises 400
- [ ] Test added to `tests/test_reports.py` covering `end < start` → 400

## Work Log

- 2026-03-09: Found by kieran-python-reviewer and data-integrity-guardian during ce:review
