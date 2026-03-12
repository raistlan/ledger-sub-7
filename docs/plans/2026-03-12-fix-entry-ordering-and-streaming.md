# Plan: Fix Entry Insertion-Order Bug + Streaming Home Loader

## Context

**Bug:** Entries added on the same calendar day appear in unpredictable order. `ORDER BY date ASC, id ASC` uses a random v4 UUID as tiebreaker — `gen_random_uuid()` has no temporal ordering. PLANNING.md specified `created_at`/`updated_at` on all models (lines 240–249) but they were never implemented.

**Fix 1 (backend):** Add `created_at TIMESTAMPTZ DEFAULT now()` to all models; sort by `created_at` instead of `id`.

**Fix 2 (frontend):** While here, restructure the home loader to parallelize `user+budget` and defer `entries` — making the calculator immediately interactive (one fewer network round-trip before the page is usable).

User is happy to nuke and recreate the local DB.

---

## Index Decision (confirmed by user)

- **Keep:** `(user_id, date ASC, created_at ASC)` replacing the old `(user_id, date DESC)` — optimal for main read query, 2 total indexes (unchanged count)
- **Keep:** `ix_entries_budget_id_date` — future-proofed for multi-budget

### Write overhead analysis

At personal-app scale (realistic max ~10,000 total entries), write performance is academic:

| Rows | B-tree index update (per INSERT) |
|------|:---:|
| 1,000 | <0.1ms |
| 10,000 | <0.5ms |
| needs attention at | >1,000,000 |

Every INSERT touches both composite indexes. UPDATEs to `amount`, `type`, or `memo` touch **0 indexes** (those columns don't appear in any index). Only date-edits (rare) trigger index updates. The wider composite key vs today's 2-column key costs ~8 bytes of extra storage per row.

### Security: timestamps in serializers

Both `entry_to_dict()` (entries.py) and the two inline dict blocks in reports.py use **explicit field whitelists**. Adding `created_at`/`updated_at` to the SQLAlchemy model will NOT automatically expose them in API responses. Must not add these fields to either serializer.

---

## Part 1: Backend — `created_at` Fix

### Files changed

#### `backend/app/models.py`

Added to ALL THREE models (User, Budget, Entry):

```python
from datetime import datetime
from sqlalchemy import DateTime
from sqlalchemy.sql import func

created_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), server_default=func.now(), nullable=False
)
updated_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
)
```

Added composite index to Entry's `__table_args__`:
```python
from sqlalchemy import Index

__table_args__ = (
    CheckConstraint("amount > 0", name="ck_entries_amount_positive"),
    CheckConstraint("type IN ('expense', 'credit')", name="ck_entries_type"),
    Index("ix_entries_user_id_date_created_at", "user_id", "date", "created_at"),
)
```

#### `backend/app/routers/entries.py`

```python
# was:
stmt = stmt.order_by(Entry.date.asc(), Entry.id.asc())
# now:
stmt = stmt.order_by(Entry.date.asc(), Entry.created_at.asc())
```

#### `backend/app/routers/reports.py`

Same `order_by` fix.

#### `backend/alembic/versions/001_initial_schema.py`

Added to each table creation block (users, budgets, entries):
```python
sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
```

Replaced the entries index:
```python
# Removed:
op.create_index("ix_entries_user_id_date_desc", "entries", ["user_id", sa.text("date DESC")])
# Added:
op.create_index("ix_entries_user_id_date_created_at", "entries", ["user_id", "date", "created_at"])
```

DB was nuked and recreated with `alembic upgrade head`.

---

## Part 2: Frontend — Streaming Home Loader

### Why this improves perceived speed

**Previous loader flow:**
```
T0: auth/me ─────────────────► T1: budget + entries ──► T2: page renders
                                    (parallel pair)
```
Calculator locked until T2 — two round-trips before anything is interactive.

**With defer:**
```
T0: auth/me + budget ──────► T1: page renders (calculator interactive!)
                  └──────────────────────────────────────────► T2: entries appear
```
Calculator is interactive after ONE round-trip.

### Changes

- Loader: `Promise.all([user, budget])` then `defer({ entries: api.get(...) })`
- Extracted `HomeEntriesSection` component: header stats + PipBar + entry list
- Added `HomeEntriesSkeleton`: shows `$---.--` and `LOADING...` while entries stream
- Main component wraps section in `<Suspense>` + `<Await>`
- Kebab button lifted to absolute positioning so it's always visible

### TypeScript note

RR v7 generated types don't handle `defer()` return types — `loaderData.entries` is cast:
```ts
const entriesDeferred = loaderData.entries as unknown as Promise<Entry[]>;
```

---

## Part 3: Tests

New file: `frontend/app/routes/home.test.tsx`

Tests for `HomeEntriesSkeleton` and `HomeEntriesSection` covering:
- Budget amount shown in skeleton
- Days left uses correct `week_start_day`
- Loading placeholder text
- Net computation
- OVER budget display
- Empty entries message
- selectedId cleanup on entry removal

---

## Files Modified

| File | Change |
|------|--------|
| `backend/app/models.py` | Add `created_at` + `updated_at` to User, Budget, Entry; `Index(...)` in Entry `__table_args__` |
| `backend/app/routers/entries.py` | `order_by` tiebreaker: `id` → `created_at` |
| `backend/app/routers/reports.py` | Same `order_by` fix |
| `backend/alembic/versions/001_initial_schema.py` | Add timestamp columns; replace DESC index with ASC+created_at |
| `frontend/app/routes/home.tsx` | Parallel user+budget, defer entries, `HomeEntriesSection` + `HomeEntriesSkeleton`, `<Suspense>` + `<Await>` |
| `frontend/app/routes/home.test.tsx` | **New** — tests for `HomeEntriesSection` and `HomeEntriesSkeleton` |
