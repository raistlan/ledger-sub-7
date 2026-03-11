---
status: pending
priority: p3
issue_id: "023"
tags: [frontend, architecture, dry]
dependencies: []
---

# Logout logic duplicated in home.tsx and settings.tsx

## Problem Statement

Both `home.tsx:71-74` and `settings.tsx:40-43` independently handle `intent === "logout"`
by calling `api.post("/auth/logout", {})` and redirecting to `/login`. If logout behavior
is extended, both places must be updated.

## Findings

- `frontend/app/routes/home.tsx:71-74` — logout action branch
- `frontend/app/routes/settings.tsx:40-43` — identical logout action branch

## Proposed Solutions

### Option A — Resource route for logout
Create `frontend/app/routes/logout.ts`:
```typescript
export async function action({ request }: ActionFunctionArgs) {
  const api = new ApiClient(request.headers.get("Cookie") ?? "");
  await api.post("/auth/logout", {});
  throw redirect("/login");
}
```
Both home.tsx and settings.tsx submit to `action="/logout"`.

### Option B — Shared utility function
Extract to a helper called from both action functions.

## Recommended Action

Option A — resource route is the React Router idiomatic pattern.

## Acceptance Criteria

- [ ] Single `logout.ts` route owns logout logic
- [ ] home.tsx and settings.tsx logout forms post to `/logout`
- [ ] Logout still redirects to /login correctly

## Work Log

- 2026-03-09: Found by architecture-strategist during ce:review
