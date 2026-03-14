# Frontend OAuth Callback (BFF Auth Refactor)

## Problem Statement

The current auth flow has the backend handle the full Google OAuth redirect and callback. This creates an insoluble cookie domain problem in the two-service Railway deployment: the `access_token` cookie is set on the backend domain, but the browser never sends it to the frontend SSR domain, so every SSR loader call is unauthenticated.

There is also a pre-existing bug: `login.tsx:89` links to `/api/v1/auth/login` as a relative URL, which 404s in a two-service deployment because the frontend has no such route.

This plan moves the OAuth login redirect and callback handling to the frontend SSR. The browser ends up on a single custom domain for all interaction, cookies are set on that domain, and auth works correctly.

---

## Security Analysis

Before committing to this approach, a thorough review was done against RFC 9700 (OAuth 2.0 Security BCP, Jan 2025), RFC 6819, IETF draft-ietf-oauth-browser-based-apps, and OWASP guidance. Findings:

### What is NOT a concern in this design

- **Client secret on two services:** In the correct design below, the frontend SSR does NOT receive or store the Google `client_secret`. It only holds the `GOOGLE_CLIENT_ID` (which is already public — it appears in the OAuth redirect URL the browser sees). The secret stays on the backend exclusively.
- **JWT in the backend response body:** The JWT travels from backend → frontend SSR server-to-server over HTTPS (Railway internal network). This is semantically equivalent to the current pattern. The final delivery to the browser is still an httpOnly cookie. This is not a meaningful exposure.
- **Node.js as a confidential OAuth client:** Both SSR servers are "confidential clients" per the OAuth spec. Neither exposes secrets to the browser. RFC 9700 does not prefer Python over Node.js.

### What IS a real concern

1. **PKCE is absent from the current implementation.** RFC 9700 explicitly requires PKCE even for confidential clients (servers with a client secret). PKCE defends against authorization code injection — a stolen code is useless without the corresponding `code_verifier`. This plan adds PKCE. It is not optional.

2. **npm supply chain is a higher-risk environment than Python/pip** for reading environment variables via a compromised transitive dependency. This is mitigated by: (a) the frontend SSR not holding the client secret, and (b) PKCE making any stolen code useless.

3. **State parameter and CSRF.** The state cookie is now set on the frontend domain. This is fine — the cookie is httpOnly, validated strictly, and invalidated immediately after a single use. Risk is equivalent to the current architecture.

### No attack vectors are opened that do not already exist

The current backend-only flow also lacks PKCE. This plan adds it. The net security posture after this change is strictly better than the current state.

### Original design intent

ADR-002 actually described this flow from the beginning:
> "Frontend redirects to Google OAuth consent. Google redirects back with authorization code. Frontend POSTs code to `/api/v1/auth/google`."

The current implementation deviated from the ADR. This plan restores alignment with it.

---

## Approach

The frontend SSR owns the OAuth redirect and callback. The backend owns the code exchange (keeps the client secret) and user/session logic.

### Flow

```
1. Browser → GET /auth/login (frontend SSR)
   ├── generates code_verifier + code_challenge (PKCE)
   ├── generates state (CSRF)
   ├── stores code_verifier + state in httpOnly cookies on frontend domain
   └── redirects browser to Google with code_challenge + state

2. Google → GET /auth/callback?code=...&state=... (frontend SSR)
   ├── validates state === oauth_state cookie (CSRF check)
   ├── reads code_verifier from cookie
   ├── calls backend POST /api/v1/auth/exchange {code, code_verifier, redirect_uri}
   ├── backend exchanges with Google, upserts user, returns {token}
   ├── frontend SSR sets access_token + csrf_token as httpOnly cookies on frontend domain
   └── redirects browser to /

3. Browser → GET / (frontend SSR) with cookies → SSR forwards cookies to backend → auth works
```

### Key design decisions

- Frontend SSR holds: `GOOGLE_CLIENT_ID`, `GOOGLE_REDIRECT_URI` (its own callback URL), `BACKEND_URL`
- Backend holds: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (for verification with Google)
- `client_secret` never touches the frontend process
- PKCE: `code_verifier` generated on the frontend, sent to backend, backend sends to Google
- State cookie: `SameSite=Lax`, httpOnly, max_age=600 seconds, deleted immediately after use
- PKCE cookie: same attributes as state cookie

---

## Files Affected

### Backend

- `backend/app/routers/auth.py`
  - Add `POST /api/v1/auth/exchange` endpoint: accepts `{code, code_verifier, redirect_uri}`, exchanges with Google, upserts user, returns `{"data": {"token": "<jwt>"}}` in response body
  - Remove `GET /api/v1/auth/login` (no longer used)
  - Remove `GET /api/v1/auth/callback` (no longer used)
  - Remove `_set_auth_cookie()` (now done on the frontend side)
  - Keep `GET /auth/me`, `PATCH /auth/me`, `POST /auth/logout`

- `backend/app/config.py`
  - No new settings needed

- `backend/tests/` — new or updated test for the exchange endpoint

### Frontend

- `frontend/app/routes/auth.login.tsx` (**new**)
  - Generates `code_verifier` (random 43–128 char string), computes `code_challenge = base64url(sha256(code_verifier))`
  - Generates `state` (random string)
  - Sets `oauth_state` and `pkce_verifier` cookies (httpOnly, SameSite=Lax, max_age=600)
  - Returns a redirect response to Google's authorization URL

- `frontend/app/routes/auth.callback.tsx` (**new**)
  - Reads `code`, `state` from URL params
  - Reads `oauth_state`, `pkce_verifier` from cookies
  - Validates state strictly; redirects to `/login?error=oauth_failed` on mismatch
  - POSTs `{code, code_verifier, redirect_uri}` to backend `/api/v1/auth/exchange`
  - Clears `oauth_state` and `pkce_verifier` cookies
  - Sets `access_token` and `csrf_token` cookies on the frontend domain
  - Redirects to `/`

- `frontend/app/routes/login.tsx`
  - Change `href="/api/v1/auth/login"` → `href="/auth/login"` (fix the broken relative URL bug)

- `frontend/app/lib/api.server.ts`
  - Add `exchange(code, codeVerifier, redirectUri)` method or a standalone function for the unauthenticated exchange call (no auth cookie needed)

- `frontend/.env` / Railway environment variables
  - Add `GOOGLE_CLIENT_ID` and `GOOGLE_REDIRECT_URI` (e.g. `https://ledgersub7.raistlanschade.com/auth/callback`)

### Google Cloud Console

- Remove old redirect URI: `https://api.ledgersub7.raistlanschade.com/api/v1/auth/callback`
- Add new redirect URI: `https://ledgersub7.raistlanschade.com/auth/callback`
- Authorized origins: `https://ledgersub7.raistlanschade.com` (unchanged)

### Railway

- Backend service: remove `GOOGLE_REDIRECT_URI` pointing to the backend domain (or update to the frontend domain for the exchange verification step — Google requires the `redirect_uri` in the exchange request to match what was used in the original redirect)
- Frontend service: add `GOOGLE_CLIENT_ID`, `GOOGLE_REDIRECT_URI`

---

## Acceptance Criteria

- [ ] `GET /auth/login` on the frontend generates a PKCE pair and state, sets cookies, and redirects to Google
- [ ] `GET /auth/callback` validates state, exchanges via backend, sets httpOnly cookies, redirects to `/`
- [ ] PKCE `code_verifier` is included in the exchange and verified by Google (test: exchange fails if verifier is wrong)
- [ ] State mismatch results in redirect to `/login?error=oauth_failed`, not an error page
- [ ] `oauth_state` and `pkce_verifier` cookies are deleted after a single use (whether successful or failed)
- [ ] `access_token` cookie is set on the frontend domain, not the backend domain
- [ ] SSR loaders on `/` and other routes receive the cookie and authenticate successfully
- [ ] Backend `POST /api/v1/auth/exchange` is not callable without a valid Google code (no secret bypass)
- [ ] Old backend `/auth/login` and `/auth/callback` routes are removed
- [ ] `login.tsx` sign-in link correctly points to `/auth/login`
- [ ] All existing backend tests still pass
- [ ] New exchange endpoint has at least: success case, invalid code case, state/verifier mismatch case

---

## Build Order

Per CLAUDE.md Rule 4 (back-to-front):

1. Backend: write tests for `POST /api/v1/auth/exchange` → implement endpoint → verify tests pass
2. Backend: remove old `/auth/login` and `/auth/callback` routes
3. Frontend: implement `auth.login.tsx` (PKCE + state generation, Google redirect)
4. Frontend: implement `auth.callback.tsx` (validation, exchange call, cookie set)
5. Frontend: fix `login.tsx` href
6. Frontend: update env vars in Railway
7. Google Cloud Console: swap redirect URI
8. Smoke test end-to-end

---

## Notes

- `react-router` v7 `loader` functions return `Response` objects, so setting cookies is done via `headers: { "Set-Cookie": "..." }` in the response — no special library needed
- PKCE `code_challenge` requires SHA-256. Node.js has `crypto.subtle.digest` (Web Crypto API) available in the SSR runtime, or the built-in `node:crypto` module
- The `redirect_uri` sent to backend must exactly match what was sent to Google in the original redirect — store it or derive it deterministically from the known frontend domain
- `GOOGLE_REDIRECT_URI` on the backend is still needed for the exchange call (Google validates it matches)
