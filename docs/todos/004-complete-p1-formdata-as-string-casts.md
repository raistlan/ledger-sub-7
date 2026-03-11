---
status: pending
priority: p1
issue_id: "004"
tags: [correctness, frontend, type-safety]
dependencies: []
---

# `as string` casts on nullable FormData fields mask null failures

## Problem Statement

All action handlers in `home.tsx` and `settings.tsx` cast `FormData.get()` results with
`as string`. `FormData.get()` returns `FormDataEntryValue | null`. When a required field
is absent or renamed, the `as string` cast silently produces `null`, and `parseFloat(null as string)`
returns `NaN` which is silently POSTed to the API as an amount. The TypeScript compiler
cannot catch this at compile time.

## Findings

- `frontend/app/routes/home.tsx:42,55,62` — `formData.get("intent") as string`, `as string` on amount
- `frontend/app/routes/settings.tsx:25,28,29` — same pattern
- `parseFloat(null as string)` → `NaN` → silently sent to backend

## Proposed Solutions

### Option A — Guard before cast (Recommended)
```typescript
const rawAmount = formData.get("amount");
if (typeof rawAmount !== "string") return { ok: false, error: "Missing amount" };
const amount = parseFloat(rawAmount);
if (isNaN(amount)) return { ok: false, error: "Invalid amount" };

const intent = formData.get("intent");
if (typeof intent !== "string") return { ok: false, error: "Missing intent" };
```

### Option B — Utility helper
```typescript
function requireString(fd: FormData, key: string): string {
  const v = fd.get(key);
  if (typeof v !== "string") throw new Error(`Missing field: ${key}`);
  return v;
}
```

## Recommended Action

Option A — inline guards are clear and match the existing style.

## Technical Details

- Files: `frontend/app/routes/home.tsx`, `frontend/app/routes/settings.tsx`

## Acceptance Criteria

- [ ] All `formData.get(x) as string` replaced with type-guarded patterns
- [ ] `isNaN` check applied after `parseFloat`
- [ ] TypeScript `strict` mode passes without the casts

## Work Log

- 2026-03-09: Found by kieran-typescript-reviewer during ce:review
