---
status: pending
priority: p2
issue_id: "009"
tags: [performance, backend, database, reports]
dependencies: []
---

# Reports aggregation done in Python instead of SQL

## Problem Statement

`/reports/summary` fetches all matching `Entry` rows as full ORM objects, then aggregates
in Python with `sum()` comprehensions. A user with 3 entries/day accumulates ~1,100 entries/year.
The MAX_DATE_RANGE_DAYS=400 cap means up to ~1,200 full row fetches including memo text on
every report load. This should be pushed into the database.

## Findings

- `backend/app/routers/reports.py:35-50` — `result.scalars().all()` then Python sum loops
- `ix_entries_user_id_date_desc` index exists and would cover an aggregation query

## Proposed Solutions

### Option A — SQL aggregation with func.sum + case (Recommended)
```python
from sqlalchemy import func, case

stmt = (
    select(
        func.sum(case((Entry.type == "expense", Entry.amount), else_=0)).label("total_spent"),
        func.sum(case((Entry.type == "credit", Entry.amount), else_=0)).label("total_credits"),
    )
    .where(Entry.user_id == current_user.id)
    .where(Entry.date >= start)
    .where(Entry.date <= end)
)
result = await db.execute(stmt)
row = result.one()
```
Still fetch individual rows only for the non-grouped flat response.

### Option B — Keep Python aggregation with a SELECT on (amount, type) only
Reduce data transfer by not fetching memo/id for the aggregation.

## Recommended Action

Option A — push aggregation to SQL, especially for the group_by=week path.

## Technical Details

- File: `backend/app/routers/reports.py:35-50`

## Acceptance Criteria

- [ ] Total aggregations computed via SQL, not Python loops
- [ ] group_by=week path uses a GROUP BY query
- [ ] Performance: report query for 1000 entries completes in <50ms

## Work Log

- 2026-03-09: Found by performance-oracle and architecture-strategist during ce:review
