---
status: pending
priority: p2
issue_id: "013"
tags: [frontend, typescript, architecture, dry]
dependencies: []
---

# ApiClient has 5 near-identical HTTP methods with no shared dispatch

## Problem Statement

`api.server.ts` has `get`, `post`, `put`, `patch`, and `delete` methods that each independently
construct the full `fetch` call, duplicate the 401 redirect guard, and duplicate the `body.data`
extraction. If 401 handling must change (e.g., add 403 handling, request tracing headers),
the change must be made in 5 places.

## Findings

- `frontend/app/lib/api.server.ts:10-105` — 5 methods with duplicated fetch/redirect/parse logic

## Proposed Solutions

### Option A — Private #request method (Recommended)
```typescript
class ApiClient {
  async #request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BACKEND_URL}/api/v1${path}`, {
      method,
      headers: { "Content-Type": "application/json", Cookie: this.cookieHeader },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 401) throw redirect("/login");
    const json = await res.json();
    return json.data as T;
  }

  get<T>(path: string) { return this.#request<T>("GET", path); }
  post<T>(path: string, body: unknown) { return this.#request<T>("POST", path, body); }
  // etc.
}
```
~60 lines → ~30 lines.

## Recommended Action

Option A.

## Technical Details

- File: `frontend/app/lib/api.server.ts`

## Acceptance Criteria

- [ ] Single `#request` (or `_request`) method handles fetch/redirect/parse
- [ ] All 5 public methods delegate to it
- [ ] Behavior identical to current implementation

## Work Log

- 2026-03-09: Found by kieran-typescript-reviewer and architecture-strategist during ce:review
