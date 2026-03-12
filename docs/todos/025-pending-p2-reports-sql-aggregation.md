# TODO 025 — Reports: SQL Aggregation

**Status:** pending
**Priority:** P2

## Problem

Reports currently fetches full ORM objects and aggregates in Python:

```python
stmt = select(Entry).where(...)
entries = result.scalars().all()

total_spent = sum(e.amount for e in entries if e.type == "expense")
total_credits = sum(e.amount for e in entries if e.type == "credit")
```

This is the larger performance win for the reports page — SQL aggregation (`SUM`, `GROUP BY`) would eliminate Python-side iteration over potentially hundreds of rows and reduce data transfer.

## Proposed fix

Use `select(func.sum(...).filter(...))` or `GROUP BY type` aggregation directly in the query. For the `group_by=week` case, group by week-start computed via `date_trunc` or equivalent.

## Notes

- Todo 009 already tracks the Python aggregation issue broadly; this is the specific implementation plan
- Don't implement during the streaming session — separate PR
- The streaming change (defer entries) is a different improvement orthogonal to this
