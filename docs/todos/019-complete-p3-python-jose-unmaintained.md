---
status: pending
priority: p3
issue_id: "019"
tags: [backend, security, dependencies]
dependencies: []
---

# `python-jose` is pinned to an unmaintained library with historical CVEs

## Problem Statement

`python-jose[cryptography]==3.3.0` has not been updated since 2022 and has historical CVEs
(CVE-2024-33663 — algorithm confusion). The application mitigates the most dangerous attack
with explicit `algorithms=["HS256"]`, but using an unmaintained library is a supply-chain risk.

## Findings

- `backend/requirements.txt:9` — `python-jose[cryptography]==3.3.0`
- `backend/app/dependencies.py:20` — `algorithms=["HS256"]` correctly pinned (mitigates alg confusion)

## Proposed Solutions

### Option A — Migrate to PyJWT (Recommended)
`PyJWT` is actively maintained and has a nearly identical API:
```python
import jwt  # PyJWT
token = jwt.encode(payload, secret, algorithm="HS256")
decoded = jwt.decode(token, secret, algorithms=["HS256"])
```
Replace `python-jose` with `PyJWT>=2.8.0` in requirements.txt.

### Option B — Pin to joserfc
More complete JOSE support but less adoption.

## Recommended Action

Option A — PyJWT migration, minimal API surface change.

## Acceptance Criteria

- [ ] `python-jose` removed from requirements.txt
- [ ] `PyJWT>=2.8.0` added
- [ ] JWT encode/decode calls updated in auth.py and dependencies.py
- [ ] All auth tests pass

## Work Log

- 2026-03-09: Found by security-sentinel during ce:review
