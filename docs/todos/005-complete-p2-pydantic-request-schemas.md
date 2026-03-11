---
status: pending
priority: p2
issue_id: "005"
tags: [backend, python, fastapi, validation]
dependencies: []
---

# `body: dict` manual validation should be Pydantic request schemas

## Problem Statement

All mutation endpoints accept `body: dict` and manually validate fields with try/except +
isinstance checks. FastAPI exists to eliminate this boilerplate. Using raw dicts:
- Bypasses FastAPI's automatic 422 generation
- The centralized `RequestValidationError` handler in `main.py` never fires for these endpoints
- No OpenAPI schema documentation
- Inconsistent error shapes vs. type-checked endpoints

## Findings

- `backend/app/routers/entries.py` — `POST /entries`, `PUT /entries/{id}`
- `backend/app/routers/budget.py:32` — `PUT /budget`
- `backend/app/routers/auth.py:156` — `PATCH /auth/me`

## Proposed Solutions

### Option A — Define Pydantic BaseModel schemas per endpoint (Recommended)
```python
from pydantic import BaseModel, condecimal
from typing import Literal
from datetime import date

class EntryCreate(BaseModel):
    amount: Decimal
    type: Literal["expense", "credit"]
    date: date
    memo: str | None = None

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v

async def create_entry(body: EntryCreate, ...):
    ...
```

## Recommended Action

Option A — define schemas for all 4 endpoints.

## Technical Details

- Files: `backend/app/routers/entries.py`, `backend/app/routers/budget.py`, `backend/app/routers/auth.py`
- Schemas can live in a `backend/app/schemas.py` module

## Acceptance Criteria

- [ ] `EntryCreate`, `EntryUpdate`, `BudgetUpdate`, `UserUpdate` Pydantic schemas defined
- [ ] All mutation endpoints use typed schemas instead of `body: dict`
- [ ] Invalid requests return 422 from the centralized handler in `main.py`
- [ ] Manual isinstance/try-except blocks removed from route handlers

## Work Log

- 2026-03-09: Found by kieran-python-reviewer and architecture-strategist during ce:review
