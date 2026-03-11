---
status: pending
priority: p2
issue_id: "024"
tags: [backend, auth, jwt, frontend]
dependencies: []
---

# Add token refresh endpoint to enable silent session healing

## Problem Statement

The backend currently issues 14-day JWTs with no way to renew them without a full
re-authentication via Google OAuth. When a token expires, the frontend must redirect the
user to the login page, which interrupts their workflow and destroys any in-progress form
state.

The frontend error-boundary plan (see plan `misty-dreaming-muffin`) handles this gracefully
at the UI layer, but still requires the user to manually re-login. A token refresh endpoint
would allow the network layer to silently heal an expired access token before React Router
ever sees the error — making expiry invisible to the user.

## Current Behavior

- Backend issues one token: `access_token` (JWT, 14-day TTL, HttpOnly cookie)
- No `/api/v1/auth/refresh` endpoint exists
- Expired token → 401 → frontend ErrorBoundary → user is redirected to login

## Proposed Solution

Implement a dual-token scheme: a short-lived **access token** plus a long-lived **refresh
token**. The frontend network layer can then intercept 401s, call refresh, and retry the
original request transparently.

### Backend Changes

1. **Add `refresh_token` cookie** on login/callback:
   - Short-lived access token: 15–60 minutes
   - Long-lived refresh token: 14–30 days, stored as a separate HttpOnly cookie

2. **New endpoint** `POST /api/v1/auth/refresh`:
   - Reads the `refresh_token` cookie
   - Validates it (signature + expiry + not revoked)
   - Issues a new `access_token` cookie
   - Returns `200 OK` or `401` if refresh token is invalid/expired

3. **Optional: Refresh token revocation table** in the database to support:
   - Logout invalidating all tokens (not just the access token)
   - "Log out all sessions" functionality

### Frontend Changes (after backend is ready)

Update `frontend/app/lib/api.server.ts` to implement the interceptor pattern:

```ts
// Pseudocode in api.server.ts private request():
const res = await fetch(...);
if (res.status === 401) {
  // Attempt silent refresh
  const refreshRes = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { Cookie: this.cookieHeader },
  });
  if (refreshRes.ok) {
    // Retry original request with new cookie from Set-Cookie header
    // (note: in SSR context, Set-Cookie from refresh must be forwarded to the browser)
    return this.request(method, path, body); // retry once
  }
  // Refresh failed — propagate 401 to ErrorBoundary
  throw new Response("Unauthorized", { status: 401 });
}
```

> **SSR complication**: In a React Router SSR loader, the refreshed `Set-Cookie` header from
> the backend must be forwarded to the browser response. This requires the loader to catch
> the new cookie and attach it to the `Response` headers. This is doable but requires
> careful plumbing through the loader return path.

### OAuth `redirectTo` (bonus)

When implementing the refresh endpoint, also consider passing `redirectTo` through the
Google OAuth state parameter so that the full redirect round-trip (expired → login → OAuth
→ return to original page) works end-to-end.

- Backend: Include `redirectTo` in the OAuth `state` param on `/auth/login`
- Backend: On `/auth/callback`, read `redirectTo` from state and use it as the final redirect target

## Acceptance Criteria

- [ ] `POST /api/v1/auth/refresh` returns a new `access_token` cookie when given a valid refresh token
- [ ] `POST /api/v1/auth/refresh` returns 401 when refresh token is missing/expired/invalid
- [ ] Frontend SSR interceptor retries once on 401, forwarding the new cookie to the browser
- [ ] User experiences no interruption when access token expires mid-session
- [ ] Logout clears both `access_token` and `refresh_token` cookies
- [ ] (Stretch) `redirectTo` is preserved through the full OAuth round-trip

## Work Log

- 2026-03-10: Created as out-of-scope companion to frontend error-boundary plan
