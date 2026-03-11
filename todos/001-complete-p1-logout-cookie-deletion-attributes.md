---
status: pending
priority: p1
issue_id: "001"
tags: [security, auth, cookie]
dependencies: []
---

# Logout cookie deletion does not match Set-Cookie attributes

## Problem Statement

`response.delete_cookie("access_token")` in `auth.py:178` is called without the same
`httponly`, `secure`, and `samesite` attributes used when the cookie was set. RFC 6265 requires
deletion responses to match the original cookie's attributes. In production (`secure=True`),
the browser may treat the deletion as targeting a different cookie and leave the original
httpOnly Secure cookie intact. The user's JWT remains valid for up to 14 days after logout.

## Findings

- `backend/app/routers/auth.py:178` — `response.delete_cookie("access_token")` with no params
- `backend/app/routers/auth.py:152` — `_set_auth_cookie` sets `httponly=True`, `secure=is_prod`, `samesite="lax"`
- Mismatch means logout silently fails in production for some browsers

## Proposed Solutions

### Option A — Match attributes on delete_cookie (Recommended)
```python
response.delete_cookie(
    "access_token",
    httponly=True,
    secure=settings.ENVIRONMENT == "production",
    samesite="lax",
)
```
Pros: Correct, minimal change. Cons: None.

### Option B — Reuse _set_auth_cookie with empty token and max_age=0
Pros: DRY. Cons: Slightly more complex helper signature.

## Recommended Action

Option A — 3-line fix, immediate correctness.

## Technical Details

- File: `backend/app/routers/auth.py:178`
- Behavior: POST /auth/logout endpoint

## Acceptance Criteria

- [ ] `delete_cookie` call includes `httponly=True`, `secure` matching env, `samesite="lax"`
- [ ] Manual test: login → logout → check DevTools shows cookie cleared in production mode

## Work Log

- 2026-03-09: Found by security-sentinel agent during ce:review
