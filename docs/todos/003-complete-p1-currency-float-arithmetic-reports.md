---
status: pending
priority: p1
issue_id: "003"
tags: [correctness, backend, reports, currency]
dependencies: []
---

# Float arithmetic on currency in reports `compute_summary` causes precision loss

## Problem Statement

`reports.py` converts `Decimal` amounts to `float` before summing:
```python
total_spent = sum(float(e.amount) for e in entry_list if e.type == "expense")
```
Summing many floats introduces IEEE 754 rounding errors. The database stores `NUMERIC(12,2)`
and SQLAlchemy returns `Decimal` — converting to float before aggregation discards precision.
The `_entry_to_dict` in `entries.py` also converts single amounts to float before JSON
serialization, but a single conversion is far less harmful than summing many floats.

## Findings

- `backend/app/routers/reports.py:45-46` — `sum(float(e.amount) ...)` pattern
- `backend/app/routers/entries.py:30` — `float(entry.amount)` in serialization (lower risk)
- DB stores NUMERIC(12,2); float has 15-17 significant digits — errors compound over many entries

## Proposed Solutions

### Option A — Sum Decimals, convert at boundary (Recommended)
```python
total_spent = sum(e.amount for e in entry_list if e.type == "expense")
total_credits = sum(e.amount for e in entry_list if e.type == "credit")
return {
    "total_spent": float(round(total_spent, 2)),
    "total_credits": float(round(total_credits, 2)),
    ...
}
```

### Option B — Use `str(entry.amount)` in serialization
Return amounts as strings to avoid any float conversion, parse on frontend.
Pros: No precision loss ever. Cons: Frontend type changes needed.

## Recommended Action

Option A — keep Decimal throughout aggregation, only convert at JSON boundary.

## Technical Details

- File: `backend/app/routers/reports.py:41-50`

## Acceptance Criteria

- [ ] `total_spent` and `total_credits` computed with Decimal arithmetic
- [ ] Final JSON conversion happens after rounding
- [ ] Test: 3+ entries that would produce float rounding error → verify correct sum

## Work Log

- 2026-03-09: Found by kieran-python-reviewer during ce:review
