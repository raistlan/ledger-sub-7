---
status: pending
priority: p3
issue_id: "020"
tags: [backend, performance, auth]
dependencies: []
---

# httpx client created per-request with no timeout in OAuth callback

## Problem Statement

`auth.py:google_callback` creates a new `httpx.AsyncClient()` on every OAuth callback and
makes a call to Google with no timeout. If Google's token endpoint is slow or unresponsive,
the async worker hangs indefinitely. The `import httpx` is also deferred to inside the function.

## Findings

- `backend/app/routers/auth.py:102` — `import httpx` inside function body
- `backend/app/routers/auth.py:104` — `httpx.AsyncClient()` with no timeout

## Proposed Solutions

### Option A — Module-level import + timeout (Recommended)
```python
# top of file
import httpx

# in callback:
async with httpx.AsyncClient(timeout=10.0) as client:
    token_resp = await client.post(...)
```

### Option B — Module-level singleton client
Create one `httpx.AsyncClient` at module level and reuse it. More performant, but requires
lifespan management.

## Recommended Action

Option A — simplest correct fix.

## Acceptance Criteria

- [ ] `import httpx` moved to module level
- [ ] `timeout=10.0` (or via config) added to AsyncClient
- [ ] OAuth flow still works end-to-end

## Work Log

- 2026-03-09: Found by security-sentinel during ce:review
