---
status: pending
priority: p2
issue_id: "015"
tags: [backend, testing, coverage]
dependencies: []
---

# Missing tests for reports.py, budget.py, and PUT /entries/{id}

## Problem Statement

The most complex backend logic (`reports.py` — week grouping, date range validation) has zero
test coverage. The `budget.py` update endpoint and the `PUT /entries/{id}` update path are
also untested. The `end < start` ordering bug (todo 002) would have been caught by a test.

## Findings

- `backend/tests/` has `test_auth.py`, `test_entries.py`, `test_week_utils.py` but no `test_reports.py`
- No test for `PUT /budget`
- No test for `PUT /entries/{id}` (update path)

## Proposed Solutions

### Option A — Add test_reports.py, expand test_entries.py and test_budget.py
`test_reports.py` must cover:
- `end < start` → 400
- Date range > 400 days → 400
- `group_by=week` groups entries correctly
- `group_by=week` with non-default `week_start_day`
- Correct totals for mixed expense/credit entries

`test_entries.py` additions:
- `PUT /entries/{id}` happy path
- `PUT /entries/{id}` ownership enforcement (cannot update another user's entry)

`test_budget.py`:
- GET budget
- PUT budget happy path
- PUT budget with negative weekly_amount → 422
- Cannot update another user's budget

## Recommended Action

Option A.

## Technical Details

- New file: `backend/tests/test_reports.py`
- New file: `backend/tests/test_budget.py`
- Expand: `backend/tests/test_entries.py`

## Acceptance Criteria

- [ ] `test_reports.py` with 5+ tests covering date validation and group_by
- [ ] `test_budget.py` with 3+ tests
- [ ] `PUT /entries/{id}` covered including ownership check
- [ ] All tests pass

## Work Log

- 2026-03-09: Found by kieran-python-reviewer during ce:review
