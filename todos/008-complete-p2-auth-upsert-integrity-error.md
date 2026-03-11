---
status: pending
priority: p2
issue_id: "008"
tags: [backend, auth, data-integrity, database]
dependencies: []
---

# Auth upsert IntegrityError catch is undiscriminating

## Problem Statement

The `_upsert_user_and_budget` SAVEPOINT catch in `auth.py` catches all `IntegrityError`
without distinguishing the constraint that fired. If an `IntegrityError` is raised by a
constraint OTHER than `uq_users_google_id` (e.g., a future `uq_users_email` violation where
a different Google account shares the same email), the catch block does
`SELECT WHERE google_id = ?` which would raise `NoResultFound` — surfacing as a 500. More
importantly, the pattern is fragile: future constraints added to the schema will be silently
caught here.

## Findings

- `backend/app/routers/auth.py:59` — bare `except IntegrityError:` catches all constraint violations
- The SELECT after rollback assumes the collision was on `google_id`

## Proposed Solutions

### Option A — Inspect constraint name before falling through (Recommended)
```python
except IntegrityError as e:
    await db.rollback_to_savepoint("sp1")
    if "uq_users_google_id" not in str(e.orig):
        raise  # re-raise unexpected constraint violations
    existing = await db.execute(select(User).where(User.google_id == google_id))
    user = existing.scalar_one()
```

### Option B — Two-step: SELECT first, INSERT if not found
Try SELECT before INSERT to avoid the IntegrityError path entirely.
Pros: Cleaner. Cons: Race condition remains, just less likely.

## Recommended Action

Option A — inspect constraint name, re-raise anything unexpected.

## Technical Details

- File: `backend/app/routers/auth.py:52-64`

## Acceptance Criteria

- [ ] `IntegrityError` on non-google_id constraints is re-raised
- [ ] Test: concurrent first-login requests don't produce 500

## Work Log

- 2026-03-09: Found by data-integrity-guardian during ce:review
