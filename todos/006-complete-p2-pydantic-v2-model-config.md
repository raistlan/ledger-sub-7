---
status: pending
priority: p2
issue_id: "006"
tags: [backend, python, pydantic]
dependencies: []
---

# config.py uses deprecated Pydantic v1 `class Config` inner class

## Problem Statement

`backend/app/config.py` uses `class Config: env_file = ".env"` — the Pydantic v1 pattern.
In Pydantic v2 / `pydantic-settings`, the correct pattern is `model_config = SettingsConfigDict(...)`.
This generates deprecation warnings at startup and will break when pydantic-settings drops
backward compatibility.

## Findings

- `backend/app/config.py:14` — `class Config:` inner class
- Project uses `pydantic-settings` which is the v2 package

## Proposed Solutions

### Option A — Migrate to model_config (Recommended)
```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")
    # ... fields unchanged
```

## Recommended Action

Option A — 2-line change.

## Technical Details

- File: `backend/app/config.py:14`

## Acceptance Criteria

- [ ] `class Config` inner class removed
- [ ] `model_config = SettingsConfigDict(env_file=".env")` added
- [ ] No deprecation warnings at startup

## Work Log

- 2026-03-09: Found by kieran-python-reviewer during ce:review
