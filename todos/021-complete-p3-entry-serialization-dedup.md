---
status: pending
priority: p3
issue_id: "021"
tags: [backend, dry, architecture]
dependencies: []
---

# Entry serialization duplicated between entries.py and reports.py

## Problem Statement

`_entry_to_dict` in `entries.py:25-33` and the inline dict construction in `reports.py:70-79`
both serialize an `Entry` to a dict with the same 5 fields. If a field is added to Entry
serialization (e.g., `created_at`), the reports endpoint silently omits it.

## Findings

- `backend/app/routers/entries.py:25-33` — `_entry_to_dict` private helper
- `backend/app/routers/reports.py:70-79` — duplicate inline dict construction

## Proposed Solutions

### Option A — Move _entry_to_dict to shared location
Create `backend/app/utils/serializers.py` with `entry_to_dict(entry: Entry) -> dict`
and import from both routers.

### Option B — Use Pydantic response model (pairs with todo 005)
When Pydantic schemas are added (todo 005), a response model handles serialization
uniformly. The duplication goes away automatically.

## Recommended Action

Option B if todo 005 is done; Option A otherwise.

## Acceptance Criteria

- [ ] `_entry_to_dict` has a single owner
- [ ] reports.py imports and uses the same serializer

## Work Log

- 2026-03-09: Found by kieran-python-reviewer and architecture-strategist during ce:review
