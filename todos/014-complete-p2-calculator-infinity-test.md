---
status: pending
priority: p2
issue_id: "014"
tags: [frontend, testing, calculator]
dependencies: []
---

# Calculator Infinity test is non-binding — assertion never reached

## Problem Statement

`calculator.test.ts` tests that `evalExpression("1e400*1e400")` returns `null` for Infinity,
but the assertion is guarded: `if (result !== null) { expect(isFinite(result)).toBe(false); }`.
If `result` is `null`, the test passes trivially without ever asserting anything. The `isFinite`
guard in `evalExpression` is untested in any binding way.

## Findings

- `frontend/app/utils/calculator.test.ts:57-64` — conditional assertion that passes vacuously
- Missing tests for parentheses precedence and nested groups

## Proposed Solutions

### Option A — Fix the assertion and add parentheses tests (Recommended)
```typescript
it("returns null for Infinity", () => {
  expect(evalExpression("1e400*1e400")).toBeNull();
});

it("handles parentheses", () => {
  expect(evalExpression("(1+2)*3")).toBe(9);
  expect(evalExpression("10/(2+3)")).toBe(2);
});

it("returns null for mismatched parentheses", () => {
  expect(evalExpression("(1+2")).toBeNull();
  expect(evalExpression("1+2)")).toBeNull();
});
```

## Recommended Action

Option A.

## Technical Details

- File: `frontend/app/utils/calculator.test.ts:57-64`

## Acceptance Criteria

- [ ] Infinity test uses `toBeNull()` unconditionally
- [ ] At least 2 parentheses tests added (valid expression, mismatched)
- [ ] All tests pass

## Work Log

- 2026-03-09: Found by kieran-typescript-reviewer during ce:review
