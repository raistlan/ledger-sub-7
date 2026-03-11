---
title: Implement Ledger Sub 7 Full Application
type: feat
status: completed
date: 2026-03-07
deepened: 2026-03-09
---

# feat: Implement Ledger Sub 7 Full Application

---

## Enhancement Summary

**Deepened on:** 2026-03-09
**Research agents run:** 14 (security, architecture, performance, TypeScript, Python, DB integrity, frontend races, simplicity, data migration, deployment, best practices, framework docs, pattern recognition, Win95 design)

### Critical Findings (Fix Before Writing Any Code)

1. **Backend Dockerfile is empty** — Railway cannot build the backend service at all
2. **`requirements.txt` only has `fastapi` + `uvicorn`** — missing all database, auth, and utility deps
3. **CSRF protection deferred** — with httpOnly cookies, `SameSite=Lax` must be set on the cookie from day one; not optional
4. **`evalExpression` uses `Function()` constructor** — replace with `mathjs` or a recursive descent parser before shipping
5. **Railway `up.railway.app` is on the Public Suffix List** — `SameSite=Lax` cookies cannot be shared between `frontend.up.railway.app` and `backend.up.railway.app`; use custom domains or `SameSite=None`
6. **OAuth callback handling ambiguity** — PLANNING.md says httpOnly cookie but API design section says `Authorization: Bearer`; resolve this contradiction before building auth
7. **JS `%` operator doesn't handle negatives like Python** — `weeks.ts` must use `(dayIndex - startDay + 7) % 7` not `(dayIndex - startDay) % 7`
8. **Cookie forwarding in SSR loaders** — must use `request.headers.get("Cookie")` and forward manually to backend; `credentials: "include"` only works in browser context

### Key Improvements Added to Plan

- Full pinned `requirements.txt` with all dependencies
- Alembic async `env.py` pattern with `NullPool`
- DB-level CHECK constraints (amount > 0, weekly_amount > 0, week_start_day 0-6)
- ON DELETE CASCADE on all foreign keys
- Google OAuth state parameter CSRF defense
- JWT cookie with `SameSite`, `Secure`, explicit `HS256` algorithm pinning
- Dialog state machine (symbol enum + frozen evaluated value)
- `useFetcher` for reports range (prevents out-of-order response race)
- `shouldRevalidate` to skip budget re-fetch on entry mutations
- Win95 design precision details (title bar gradient, no border-radius, inputMode="none")
- Railway custom domain recommendation for cookie strategy
- Discriminated union return type for `api.ts` fetch wrapper
- PostgreSQL test DB recommendation (not SQLite — ENUM behavior differs)

### New Considerations Discovered

- `@vite-pwa/remix` is the only working PWA plugin for RR v7 SSR (vite-plugin-pwa doesn't support SSR as of March 2026)
- `expire_on_commit=False` on `async_sessionmaker` is non-negotiable for async SQLAlchemy
- Use `google.sub` not `email` as stable user identifier from Google OAuth
- Service layer in `backend/modules/` (directory already exists) should hold all business logic, not routers
- `entry.budget_id` must never be accepted from client — always resolved server-side

---

## Overview

Implement the full Ledger Sub 7 (L7) personal budget tracking app — a calculator-style PWA with weekly budget cycles, Google OAuth auth, and a Win95-aesthetic UI. The entire backend API (FastAPI + PostgreSQL) and frontend (React Router v7 SSR + TailwindCSS v4) need to be built from scratch, following the architectural decisions in `PLANNING.md` and the UI porting guide in `PORTING_PLAN.md`.

The frontend UI design (Win95 aesthetic, all screen components) already exists as a Figma Make prototype in `figma_make_one_shot/`. The task is wiring everything together with real data, routing, and auth.

## Problem Statement

The project currently has:

- A comprehensive PLANNING.md and PORTING_PLAN.md
- A stub backend (`GET /hello` only, `requirements.txt` with just fastapi + uvicorn)
- A stub frontend (default React Router scaffold, no real routes)
- The Win95-styled UI prototype in `figma_make_one_shot/` (not yet ported)
- **An empty backend Dockerfile** (deployment blocker)

Everything needs to be built.

## Proposed Solution

Build back-to-front per ADR implementation order: database → services → API controllers → frontend API client → frontend hooks → frontend components. Port the Figma Make UI components as the final step of each screen.

---

## Technical Approach

### Architecture

```
Browser (PWA)
    |  HTTPS
React Router v7 (Node.js SSR, Railway)
    |  fetch /api/v1/* with Cookie header forwarded
FastAPI (Python, Railway)
    |  SQLAlchemy asyncio ORM
PostgreSQL (Railway addon)
```

Auth flow:

1. Frontend initiates Google OAuth redirect (with random `state` param stored in cookie)
2. Google redirects back with `?code=&state=`
3. Login route loader validates `state`, POSTs code to `/api/v1/auth/google`
4. Backend exchanges code using `google-auth` library, verifies ID token (aud, iss, exp, sub)
5. Backend upserts User (keyed on `google.sub`), auto-creates Budget for new users in single transaction
6. Backend returns JWT in httpOnly cookie (`SameSite=Lax` with custom domains, or `SameSite=None` on up.railway.app)
7. SSR loaders forward `Cookie` header from browser request to backend for all authenticated calls

### PLANNING.md Contradiction to Resolve First

PLANNING.md API Design section says `Authorization: Bearer <token>` but ADR-002 says httpOnly cookie. The implementation uses **cookies only**. The Bearer header documentation in PLANNING.md is incorrect and must be removed to prevent confusion.

---

## Implementation Phases

### Phase 1: Backend Infrastructure

**1a. `backend/requirements.txt`** — full pinned dependencies:

```
fastapi==0.115.0
uvicorn[standard]==0.32.0
sqlalchemy[asyncio]==2.0.36
asyncpg==0.29.0
psycopg2-binary==2.9.9
alembic==1.13.3
pydantic[email]==2.7.0
pydantic-settings==2.4.0
python-jose[cryptography]==3.3.0
httpx==0.27.2
google-auth==2.35.0
cachecontrol==0.14.0
pytest==8.3.0
pytest-asyncio==0.24.0
httpx==0.27.2
```

**Research insight:** Pin all versions to prevent autogenerate drift between local and Railway. Add `pip-audit` to CI once deployed to scan for CVEs.

**1b. `backend/app/config.py`** — Pydantic Settings:

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    GOOGLE_REDIRECT_URI: str
    JWT_SECRET: str  # generate with: openssl rand -hex 32
    JWT_EXPIRE_DAYS: int = 14
    FRONTEND_URL: str

    class Config:
        env_file = ".env"

settings = Settings()
```

**1c. `backend/app/database.py`** — async SQLAlchemy engine:

```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,   # Required: detects stale Railway connections
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,  # CRITICAL: prevents DetachedInstanceError in async
    autoflush=False,
)

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
```

**Research insight:** `expire_on_commit=False` is non-negotiable for async SQLAlchemy. Without it, accessing any attribute after `commit()` triggers a lazy SQL query, which raises `MissingGreenlet` in async context. The session commits are done explicitly in route handlers for writes, not in the dependency.

**1d. `backend/app/models.py`** — SQLAlchemy models:

```python
import uuid
from decimal import Decimal
from enum import StrEnum
from sqlalchemy import Numeric, String, Integer, Date, Text, CheckConstraint, UniqueConstraint, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class EntryType(StrEnum):
    EXPENSE = "expense"
    CREDIT = "credit"

class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("week_start_day >= 0 AND week_start_day <= 6", name="ck_users_week_start_day"),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)  # NOT NULL + unique
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    google_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)  # NOT NULL; key on sub, not email
    week_start_day: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    budget: Mapped["Budget"] = relationship("Budget", back_populates="user", lazy="raise", cascade="all, delete-orphan", passive_deletes=True)
    entries: Mapped[list["Entry"]] = relationship("Entry", back_populates="user", lazy="raise", cascade="all, delete-orphan", passive_deletes=True)

class Budget(Base):
    __tablename__ = "budgets"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_budgets_user_id"),  # named explicitly for safe future drop
        CheckConstraint("weekly_amount > 0", name="ck_budgets_weekly_amount_positive"),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), default="Weekly Budget", nullable=False)
    weekly_amount: Mapped[Decimal] = mapped_column(Numeric(precision=12, scale=2), default=Decimal("100.00"), nullable=False)
    user: Mapped[User] = relationship("User", back_populates="budget", lazy="raise")

class Entry(Base):
    __tablename__ = "entries"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_entries_amount_positive"),  # DB-level enforcement
        CheckConstraint("type IN ('expense', 'credit')", name="ck_entries_type"),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    budget_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(precision=12, scale=2), nullable=False)
    type: Mapped[str] = mapped_column(String(10), nullable=False)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)
    date: Mapped[Date] = mapped_column(Date, nullable=False)
    user: Mapped[User] = relationship("User", back_populates="entries", lazy="raise")
    budget: Mapped[Budget] = relationship("Budget", lazy="raise")
```

**Research insights:**

- `lazy="raise"` on all relationships surfaces N+1 issues at test time, not production
- Use `NUMERIC(12, 2)` not `FLOAT` — floating point arithmetic is not exact for money
- `UUID(as_uuid=True)` from `sqlalchemy.dialects.postgresql` uses PostgreSQL native `uuid` column type, not `CHAR(32)`
- `server_default=text("gen_random_uuid()")` — server-side UUID generation (no extension needed on PostgreSQL 13+)
- Use CHECK constraint (not PostgreSQL ENUM) for `entry.type` — ENUM values cannot be dropped in PostgreSQL and Alembic has bugs detecting ENUM drift; CHECK constraint is trivially alterable
- `ON DELETE CASCADE` on all FKs — without this, deleting a User raises FK violation; cascade handles cleanup atomically at DB level with `passive_deletes=True`
- DB-level `CHECK (amount > 0)` — API-layer-only validation can be bypassed by migration scripts, admin tools, or bugs

**1e. `backend/alembic/env.py`** — async SQLAlchemy runner:

```python
import asyncio, os
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context
from app.models import Base

target_metadata = Base.metadata

def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()

async def run_async_migrations():
    configuration = context.config.get_section(context.config.config_ini_section)
    configuration["sqlalchemy.url"] = os.environ["DATABASE_URL"]
    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # REQUIRED: prevents event loop errors on script exit
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

def run_migrations_online():
    asyncio.run(run_async_migrations())

if context.is_offline_mode():
    # offline mode (SQL script generation)...
    pass
else:
    run_migrations_online()
```

**Research insight:** `NullPool` is mandatory for Alembic with asyncpg. The connection pool keeps connections associated with the event loop; Alembic's short-lived script exits the loop after migrations, causing `RuntimeError: Event loop is closed` with any pooling class. `NullPool` creates one connection, uses it, disposes it cleanly.

**1f. `backend/alembic/versions/001_initial_schema.py`** — initial migration:

Create tables in dependency order: users → budgets → entries. `downgrade()` must drop in reverse order. Verify: `alembic downgrade -1` must pass before any deploy.

```python
# Key additions beyond basic CREATE TABLE:
# 1. CHECK constraints (amount, weekly_amount, week_start_day)
# 2. ON DELETE CASCADE on all FKs
# 3. UniqueConstraint named "uq_budgets_user_id" (referenced by future 002 migration)
# 4. server_default=sa.text("gen_random_uuid()") for UUID PKs (no extension needed)
# 5. Composite index on entries(budget_id, date)
# 6. Composite index on entries(user_id, date DESC) — for home loader query
```

**Research insight:** Add `entries(user_id, date DESC)` composite index in addition to `entries(budget_id, date)`. The home loader queries `WHERE user_id = ? AND date BETWEEN ? AND ?` — the `budget_id` index only helps budget-scoped queries. At 5+ years of data (~5000 rows), the standalone `user_id` index forces PostgreSQL to scan all user entries and filter by date in memory.

**1g. `backend/app/utils/week.py`** — week calculation:

```python
from datetime import date, timedelta

def get_week_start(d: date, start_day: int = 0) -> date:
    """start_day: 0=Sunday, 1=Monday, ..., 6=Saturday"""
    current_day_index = (d.weekday() + 1) % 7  # Python weekday: Mon=0,Sun=6 → Sun=0,Mon=1
    days_since_start = (current_day_index - start_day) % 7  # Python % always non-negative
    return d - timedelta(days=days_since_start)

def get_week_end(d: date, start_day: int = 0) -> date:
    return get_week_start(d, start_day) + timedelta(days=6)
```

**1h. `backend/app/utils/filters.py`** — generic filter parser with allowlist:

```python
from typing import Any
from sqlalchemy.orm import DeclarativeBase

# Strict allowlist — never derive from user input
ENTRY_FILTERABLE_FIELDS: frozenset[str] = frozenset({"date", "type", "budget_id"})
ALLOWED_OPERATORS: dict[str, str] = {
    "eq": "__eq__", "ne": "__ne__", "gt": "__gt__",
    "gte": "__ge__", "lt": "__lt__", "lte": "__le__",
}

def apply_entry_filters(stmt, model_class, filters: dict[str, Any]):
    """Apply pre-validated filters. Raises ValueError for unknown fields/operators."""
    for field, ops in filters.items():
        if field not in ENTRY_FILTERABLE_FIELDS:
            raise ValueError(f"Field '{field}' is not filterable")
        for op, value in ops.items():
            if op not in ALLOWED_OPERATORS:
                raise ValueError(f"Operator '{op}' is not allowed")
            column = getattr(model_class, field)
            stmt = stmt.where(getattr(column, ALLOWED_OPERATORS[op])(value))
    return stmt
```

**Research insight:** `getattr(model_class, field_name)` with user-controlled field names is an injection surface even with the ORM. The frozenset allowlist is the only safe approach — reject anything not on the list with a 400 before touching SQLAlchemy.

---

### Phase 2: Auth API

**`backend/app/routers/auth.py`**:

```python
# POST /api/v1/auth/google — full flow:
# 1. Validate state cookie against request param (CSRF defense)
# 2. Exchange code via google-auth library (not httpx to tokeninfo directly)
# 3. Verify ID token: id_token.verify_oauth2_token(raw_token, request, audience=CLIENT_ID)
#    — verifies aud, iss, exp, signature automatically
# 4. Key user on idinfo["sub"] not idinfo["email"] (sub is immutable, email can change)
# 5. Upsert User + create Budget atomically using begin_nested() SAVEPOINT pattern
# 6. Issue JWT with explicit algorithm="HS256", expiry=14 days
# 7. Set cookie: httponly=True, secure=True, samesite="lax" (custom domains) or "none" (up.railway.app)
# 8. Delete oauth_state cookie, redirect to "/"
```

**OAuth State parameter** (CSRF defense for OAuth itself):

```python
import secrets

@router.get("/auth/login")
async def login_redirect(response: Response):
    state = secrets.token_urlsafe(32)
    google_url = f"https://accounts.google.com/o/oauth2/v2/auth?client_id={CLIENT_ID}&state={state}&..."
    response.set_cookie("oauth_state", state, httponly=True, secure=True, samesite="lax", max_age=600)
    return RedirectResponse(google_url)
```

**SAVEPOINT pattern for upsert** (prevents constraint violation on repeat logins):

```python
from sqlalchemy.exc import IntegrityError

async def upsert_user_and_budget(db: AsyncSession, google_sub: str, email: str, name: str) -> User:
    try:
        async with db.begin_nested():  # SAVEPOINT
            user = User(google_id=google_sub, email=email, name=name)
            db.add(user)
            await db.flush()
            budget = Budget(user_id=user.id)
            db.add(budget)
            await db.flush()
    except IntegrityError:
        # User already exists — SAVEPOINT rolled back, outer transaction continues
        result = await db.execute(select(User).where(User.google_id == google_sub))
        user = result.scalar_one()
    await db.commit()
    return user
```

**JWT cookie settings** (resolve before implementation):

| Scenario                            | SameSite | Secure  | domain                                  |
| ----------------------------------- | -------- | ------- | --------------------------------------- |
| Custom domains (recommended)        | `lax`    | `True`  | `.yourdomain.com`                       |
| `up.railway.app` (no custom domain) | `none`   | `True`  | omit (PSL blocks cross-service sharing) |
| Localhost dev                       | `lax`    | `False` | omit                                    |

**Research insight:** `up.railway.app` is on the Public Suffix List. Setting `domain=.up.railway.app` is rejected by browsers — `frontend.up.railway.app` and `backend.up.railway.app` are treated as separate registrable domains. **Use custom domains** (e.g., `app.yourdomain.com` + `api.yourdomain.com`) to enable `SameSite=Lax`. Without custom domains, you must use `SameSite=None; Secure` plus explicit CORS with `allow_credentials=True`.

**`backend/app/dependencies.py`** — `get_current_user`:

```python
from fastapi import Cookie, Depends, HTTPException
from jose import JWTError, jwt

async def get_current_user(
    access_token: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_db),
) -> User:
    if not access_token:
        raise HTTPException(status_code=401)
    try:
        # ALWAYS specify algorithms= explicitly — prevents "alg: none" attacks
        payload = jwt.decode(access_token, settings.JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401)
    except JWTError:
        raise HTTPException(status_code=401)
    user = await session.get(User, uuid.UUID(user_id))
    if not user:
        raise HTTPException(status_code=401)
    return user
```

**Research insights:**

- Always pass `algorithms=["HS256"]` to `jwt.decode()` — without it, the `alg: none` attack is possible
- Use `google-auth` + `cachecontrol` for token verification (caches Google's JWKS so it's not re-fetched per request)
- Key the user on `idinfo["sub"]` not `idinfo["email"]` — `sub` is an immutable Google account identifier; emails can be changed
- FastAPI `Cookie()` parameter: Python `access_token` maps to wire cookie named `access_token` (no hyphens in this case)

---

### Phase 3: Budget & Entries API

**`backend/app/routers/entries.py`** key rules:

- **Never accept `budget_id` from the client.** Always resolve it server-side: `SELECT id FROM budgets WHERE user_id = current_user.id`
- Apply mandatory base filter `entry.user_id == current_user.id` before any user-supplied filters
- Validate filter fields against `ENTRY_FILTERABLE_FIELDS` allowlist
- Date range bounds check on summary endpoint: reject ranges > 400 days with 400 error

**`backend/app/main.py`** — CORS and global error handlers:

```python
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],  # exact origin, no wildcard
    allow_credentials=True,  # required for cookie auth; wildcard FAILS with this set to True
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)

# Override default 422 to match our error format
@app.exception_handler(RequestValidationError)
async def validation_handler(request, exc):
    return JSONResponse(status_code=400, content={"error": {"code": "VALIDATION_ERROR", ...}})

# Override 500 — never leak stack traces
@app.exception_handler(Exception)
async def unhandled_handler(request, exc):
    logger.exception("Unhandled exception")
    return JSONResponse(status_code=500, content={"error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred"}})

# Health check — required by Railway
@app.get("/api/v1/health")
def health():
    return {"status": "ok"}
```

**Research insight:** Register exception handlers for both `fastapi.HTTPException` AND `starlette.exceptions.HTTPException` — FastAPI 404s come from Starlette and bypass FastAPI-only handlers.

---

### Phase 4: Frontend Shared Utilities

**`frontend/app/types/api.ts`** — single source of truth for all API types:

```typescript
export type UUID = string;
export type ISODate = string; // "YYYY-MM-DD"
export type EntryType = "expense" | "credit";
export type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // literal union, not number

export interface User {
  id: UUID;
  email: string;
  name: string;
  week_start_day: WeekStartDay;
}
export interface Budget {
  id: UUID;
  name: string;
  weekly_amount: number;
}
export interface Entry {
  id: UUID;
  budget_id: UUID;
  amount: number;
  type: EntryType;
  memo: string | null;
  date: ISODate;
}
export interface Pagination {
  limit: number;
  offset: number;
  total_count: number;
}
export interface ListResponse<T> {
  data: T[];
  pagination: Pagination;
}
export interface SingleResponse<T> {
  data: T;
}
export interface ApiError {
  code: string;
  message: string;
  details: Array<{ field: string; reason: string }>;
}
export interface ErrorResponse {
  error: ApiError;
}
```

**`frontend/app/utils/api.ts`** — discriminated union result type:

```typescript
type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: ApiError };

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: "include", // browser-side; SSR loaders forward Cookie header manually
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (res.ok) {
    const body = (await res.json()) as { data: T };
    return { ok: true, data: body.data };
  }
  const body = (await res.json()) as ErrorResponse;
  return { ok: false, status: res.status, error: body.error };
}
```

**Research insight:** The discriminated union pattern lets the caller narrow types cleanly with `if (!result.ok)` and avoids try/catch in loaders. The loader then decides whether to `throw redirect` (401), `throw data(error, {status})` (fatal), or `return data(error, {status: 400})` (inline).

**`frontend/app/utils/auth-guard.ts`** — SSR-aware:

```typescript
import { redirect } from "react-router";
import type { User } from "~/types/api";

// Call from SSR loaders — forwards Cookie header from browser request
export async function requireUser(request: Request): Promise<User> {
  const res = await fetch(`${process.env.BACKEND_URL}/api/v1/auth/me`, {
    headers: { Cookie: request.headers.get("Cookie") ?? "" }, // CRITICAL: manual forwarding
  });
  if (!res.ok) throw redirect("/login");
  const body = await res.json();
  return body.data as User;
}
```

**Research insight (CRITICAL):** SSR loaders run on the Node.js server. `credentials: "include"` is a browser-only concept — it does nothing in Node.js `fetch`. You MUST extract `request.headers.get("Cookie")` from the incoming Request and forward it explicitly as the `Cookie` header to the backend. This is the single most common SSR auth bug.

**`frontend/app/utils/weeks.ts`**:

```typescript
import type { WeekStartDay } from "~/types/api";

export function getWeekStart(d: Date, startDay: WeekStartDay = 0): Date {
  const dayIndex = d.getDay(); // 0=Sunday (matches Python's current_day_index)
  // +7 is REQUIRED: JS % does NOT return non-negative for negative inputs (unlike Python %)
  const daysSinceStart = (dayIndex - startDay + 7) % 7;
  const result = new Date(d);
  result.setDate(d.getDate() - daysSinceStart);
  return result;
}

export function getWeekEnd(d: Date, startDay: WeekStartDay = 0): Date {
  const start = getWeekStart(d, startDay);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

export function getDaysLeft(today: Date, startDay: WeekStartDay = 0): number {
  // Accepts date as parameter — do NOT call new Date() internally (SSR returns UTC, not local)
  const weekEnd = getWeekEnd(today, startDay);
  return Math.ceil(
    (weekEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function formatWeekLabel(start: Date): string {
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  return `WK OF ${months[start.getMonth()]} ${String(start.getDate()).padStart(2, "0")}`;
}
```

**Research insight:** JavaScript's `%` operator returns negative results for negative operands: `(-1) % 7 === -1` in JS but `(-1) % 7 === 6` in Python. The `+7` in `(dayIndex - startDay + 7) % 7` is mandatory for correctness when `dayIndex < startDay`. The test suite must cover the case `startDay=1 (Monday), today=Sunday` — this is the exact case that fails without `+7`.

**`frontend/app/utils/calculator.ts`** (renamed from evalExpression.ts):

```typescript
// Option A: mathjs (recommended — battle-tested, no custom sanitization needed)
import { evaluate } from "mathjs";

export function evalExpression(input: string): number | null {
  try {
    const result = evaluate(input);
    if (typeof result !== "number" || !isFinite(result) || result < 0)
      return null;
    return result;
  } catch {
    return null;
  }
}

// Option B: If mathjs is too heavy, a 50-line recursive descent parser for +,-,*,/ only
// Never use Function() constructor — even with sanitization, it's a custom eval with known gaps
```

**Research insight (SECURITY):** The `Function()` constructor is effectively `eval()`. The existing sanitization regex `[^0-9+\-*./]` has already had one known bypass (division). Replace with `mathjs.evaluate()` which is specifically designed for safe mathematical expression evaluation. Even if this runs only on the user's own device, it establishes a pattern that could be copied to a more dangerous context.

**`frontend/app/styles/win95.ts`** — rename from `app/styles/` to `app/utils/win95.ts` (it's a TypeScript module exporting functions, not a stylesheet). Copy from `figma_make_one_shot/src/app/components/win95.ts`.

**`frontend/app/components/W95Btn.tsx`** — key Win95 details:

```typescript
// Props: children, onClick?, active?, disabled?, fullWidth?, destructive?, type?, className?
// CRITICAL: no border-radius anywhere in Win95 aesthetic
// raisedBorder(active) inline style for the 3D effect
// Disabled state: color: #808080 with 1px white shadow offset (+1px right, +1px down) — authentic embossed disabled look
// Accept className prop for layout positioning without requiring wrapper div
```

---

### Phase 5: Frontend API Client

`frontend/app/api/` files use `apiFetch` from `utils/api.ts`. `frontend/app/api/auth.ts` exports `getMe()`, `logout()`, `patchMe(weekStartDay)`. All typed against `app/types/api.ts`.

**For SSR loaders, use a server-side API client** (`app/lib/api.server.ts` — `.server.ts` suffix excludes from client bundle, preventing `BACKEND_URL` exposure):

```typescript
// .server.ts suffix — excludes from browser bundle
const API_BASE = process.env.BACKEND_URL ?? "http://localhost:8000";

export class ApiClient {
  constructor(private cookieHeader: string) {}

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}/api/v1${path}`, {
      headers: {
        Cookie: this.cookieHeader,
        "Content-Type": "application/json",
      },
    });
    if (res.status === 401) throw redirect("/login");
    if (!res.ok) throw data(await res.json(), { status: res.status });
    return (await res.json()).data as T;
  }
}

// Usage in any loader:
const api = new ApiClient(request.headers.get("Cookie") ?? "");
```

---

### Phase 6: Frontend Routes

Update `frontend/app/routes.ts`:

```typescript
export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("reports", "routes/reports.tsx"),
  route("settings", "routes/settings.tsx"),
] satisfies RouteConfig;
```

**Update `frontend/app/root.tsx`**:

- Import `fonts.css`
- Add CRT overlay once at root (position:fixed, pointer-events:none, aria-hidden="true", z-index:9999)
- Desktop layout: teal `#008080` background (canonical Win95 desktop color), centered max-450px panel with Win95 `outerBorder`
- Align panel `flex-start` not centered vertically (windows open at top of screen, not centered)

**Route: `frontend/app/routes/login.tsx`**:

```typescript
import type { Route } from "./+types/login";

export async function loader({ request }: Route.LoaderArgs) {
  // ALWAYS use generated Route types — not LoaderFunctionArgs from react-router
  const api = new ApiClient(request.headers.get("Cookie") ?? "");
  try {
    await api.get("/auth/me");
    throw redirect("/"); // already authed
  } catch (e) {
    if (e instanceof Response && e.status === 302) throw e;
    return {}; // not authed — show login
  }
}
```

**Route: `frontend/app/routes/home.tsx`** — key patterns:

```typescript
export async function loader({ request }: Route.LoaderArgs) {
  const api = new ApiClient(request.headers.get("Cookie") ?? "");
  const today = new URL(request.url).searchParams.get("date") ?? new Date().toISOString().split("T")[0];
  // Parallel fetch — both independent
  const [entries, budget, user] = await Promise.all([
    api.get<ListResponse<Entry>>(`/entries?...`),
    api.get<Budget>("/budget"),
    api.get<User>("/auth/me"),
  ]);
  return { entries: entries.data, budget, user };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const api = new ApiClient(request.headers.get("Cookie") ?? "");
  switch (intent) {
    case "create": ...
    case "delete": ...
    case "update": ...
  }
}

// shouldRevalidate: skip budget re-fetch on entry mutations
export function shouldRevalidate({ formAction, defaultShouldRevalidate }) {
  // Budget only changes when user edits it in Settings
  return defaultShouldRevalidate;
}
```

**Dialog state machine** (not two boolean flags):

```typescript
// WRONG: two booleans give 4 states, 2 of which are undefined behavior
const [showNegative, setShowNegative] = useState(false);
const [showPartialCents, setShowPartialCents] = useState(false);

// CORRECT: symbol enum with frozen value snapshot
type DialogPhase = "none" | "negative" | "partial_cents";
const [dialogPhase, setDialogPhase] = useState<DialogPhase>("none");
const [pendingEntry, setPendingEntry] = useState<{
  amount: number;
  type: EntryType;
} | null>(null);

// On submit: evaluate → if negative → set pendingEntry + setDialogPhase("negative")
//            → if partial cents → set pendingEntry + setDialogPhase("partial_cents")
//            → else → submit pendingEntry directly
// Dialog confirmation uses pendingEntry (frozen snapshot), never re-evaluates live input
```

**Race condition: double submit guard**:

```typescript
const navigation = useNavigation();
const isSubmitting = navigation.state !== "idle";
// Gate ALL submit paths on isSubmitting — Enter key, = button, keypad
if (isSubmitting) return;
```

**Race condition: logout**:

```typescript
const isLoggingOut = useRef(false); // useRef not useState — ref is synchronous
const handleLogout = () => {
  if (isLoggingOut.current) return;
  isLoggingOut.current = true;
  // submit logout form action
};
```

**Route: `frontend/app/routes/reports.tsx`** — use `useFetcher` for range changes:

```typescript
// CRITICAL: use useFetcher().load() NOT raw fetch() for range changes
// useFetcher automatically cancels in-flight requests when a new one starts
// preventing out-of-order response bugs (Last Week data appearing under This Month chip)
const fetcher = useFetcher<typeof loader>();

const handleRangeChange = (range: Range) => {
  const { start, end } = computeRange(range, user.week_start_day);
  fetcher.load(`/reports?start=${start}&end=${end}`);
};
```

---

### Phase 7: PWA Configuration

**Service worker via `@vite-pwa/remix`** — not `vite-plugin-pwa` directly:

```typescript
// vite.config.ts
import { RemixVitePWA } from "@vite-pwa/remix";
const { RemixVitePWAPlugin, RemixPWAPreset } = RemixVitePWA();

// In vitePlugin({ presets: [RemixPWAPreset()] })
// RemixVitePWAPlugin({ registerType: "autoUpdate", workbox: { ... } })
```

**Research insight:** `vite-plugin-pwa` does NOT officially support React Router v7 SSR (GitHub issue #809, open since Dec 2024, unresolved as of March 2026). `@vite-pwa/remix` is the adapter that handles the SSR build pipeline correctly. Cache versioning is automatic via content-hash in the precache manifest — no manual version bumps needed.

**Service worker registration in root.tsx** (SSR-guarded):

```typescript
useEffect(() => {
  if (typeof window === "undefined") return;
  import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}, []);
```

**`frontend/public/manifest.json`**:

```json
{
  "name": "Ledger Sub 7",
  "short_name": "L\u2087",
  "display": "standalone",
  "start_url": "/",
  "background_color": "#008080",
  "theme_color": "#000080",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

### Phase 8: Testing

**Backend** — use a dedicated PostgreSQL test database (not SQLite):

**Research insight:** SQLite does not enforce PostgreSQL's ENUM behavior or `NUMERIC` type semantics. A `CHECK constraint` violation that would fail in PostgreSQL may silently pass in SQLite. Use `postgresql+asyncpg://` test database (Docker container or Railway test addon). Add a comment in `conftest.py` explaining why SQLite is not used.

```
backend/tests/
  conftest.py           # PostgreSQL test DB, AsyncClient via httpx, auth fixture
  test_week_utils.py    # All 49 combinations (7 weekdays × 7 start_day values)
                        # MUST include: startDay=1, today=Sunday (the +7 edge case)
  test_auth.py          # Google exchange mock, /auth/me, /auth/logout, state validation
  test_budget.py        # GET + PUT, ownership, historical warning
  test_entries.py       # CRUD, filter allowlist (reject unknown fields), pagination, ownership
                        # Verify: budget_id NOT accepted from client in POST
  test_reports.py       # Summary, group_by=week, date range bounds enforcement
```

**Frontend** — add Jest to package.json first:

```json
"devDependencies": {
  "@testing-library/jest-dom": "...",
  "@testing-library/react": "...",
  "@types/jest": "...",
  "jest": "...",
  "jest-environment-jsdom": "...",
  "ts-jest": "..."
}
```

```
frontend/app/
  utils/calculator.test.ts     # addition, division (the fixed bug), negative (→null), partial cents
  utils/fmt.test.ts            # integers, decimals, zero, large numbers
  utils/weeks.test.ts          # 49 combos; MUST include startDay=1/today=Sunday (+7 edge case)
  components/W95Btn.test.tsx   # click, disabled (no click), destructive variant, fullWidth
  components/PipBar.test.tsx   # 0%, 50%, 100% (normal mode), 101% (over-budget mode boundary)
```

---

## System-Wide Impact

### Interaction Graph

Entry creation chain:

1. HomeScreen `commitEntry()` → evaluates expression → snapshot into `pendingEntry` → show dialog if needed → POST form action
2. React Router action → `ApiClient.post("/entries", {...})` → Cookie header forwarded → FastAPI
3. FastAPI: cookie → `get_current_user` → resolve `budget_id` server-side → `CHECK (amount > 0)` enforced by DB → INSERT Entry
4. React Router revalidates home loader → parallel re-fetch entries + budget → UI updates

Auth chain:

1. `getWeekStart()` (frontend) generates login URL with random `state` → stored in cookie
2. Google redirect → POST code + state to `/api/v1/auth/google`
3. Backend validates state → exchanges code → verifies ID token (aud, iss, exp, sub) → upserts User+Budget in SAVEPOINT transaction → issues JWT in httpOnly cookie
4. All subsequent SSR loaders: `request.headers.get("Cookie")` → forwarded to backend → authenticated

### Error Propagation

- 401 from any endpoint → `throw redirect("/login")` in loader (per ADR-009)
- 400 validation errors → `return data(error, {status: 400})` from action → displayed inline in form
- 404 → `throw data(errorBody, {status: 404})` → ErrorBoundary "Not found"
- 500 → `throw data(errorBody, {status: 500})` → ErrorBoundary generic error with retry
- Stack traces and DB error messages NEVER exposed in API responses

### State Lifecycle Risks

- New user signup: User upsert + Budget creation in SAVEPOINT transaction. `ON CONFLICT DO NOTHING` on Budget INSERT prevents IntegrityError on repeat logins.
- Entry selected for edit then deleted: `useEffect` that clears `selectedEntry` when ID is absent from revalidated loader data
- Dialog chain with stale expression: `pendingEntry` frozen at dialog-open time, never re-evaluated from live input state
- `week_start_day` change in Settings: navigate to `/` after save so home loader re-runs with new week boundaries

### API Surface Parity

`week_start_day` algorithm used in 3 places — all must be identical:

1. `backend/app/utils/week.py` `get_week_start()` (reports grouping, boundary queries)
2. `frontend/app/utils/weeks.ts` `getWeekStart()` (home entry filter params, days-left calculation)
3. Frontend `formatWeekLabel()` (status bar display)

Test parity: both backend and frontend tests must cover all 49 combinations.

### Integration Test Scenarios

1. New user signs up → budget auto-created → home shows $0.00 / $100.00
2. User types `10/2` → evaluates to $5.00 (division bug fixed) → entry created
3. User types `10+5.50` → evaluates to $15.50 → home updates → reports summary matches
4. User changes week_start_day from 0→1 → home shows Mon-Sun entries (not Sun-Sat)
5. Spend > budget → PipBar switches to red→black gradient → remaining shows negative

---

## Acceptance Criteria

### Functional

- [ ] Google OAuth login/logout works end-to-end with state parameter CSRF protection
- [ ] JWT cookie: httpOnly, Secure, explicit SameSite, HS256 pinned
- [ ] Calculator input: +, -, \*, / all work (including division — bug fixed)
- [ ] Negative result dialog with correct options; uses frozen `pendingEntry` not live input
- [ ] Partial cents dialog with round up/down/cancel
- [ ] No double-submit possible (guarded by navigation.state)
- [ ] Memo field expandable, optional
- [ ] Entry list: current week, sorted date asc then id asc, day separators
- [ ] Entry edit and delete inline, `selectedEntry` cleared on revalidation if deleted
- [ ] Budget header: total_spent / weekly_budget / remaining / days_left
- [ ] PipBar: green→red (0–100%), red→black (>100%)
- [ ] Reports range chips work; no out-of-order response bug (useFetcher)
- [ ] Settings: budget edit with warning, week_start_day change, navigate to / after save
- [ ] Kebab menu navigation + logout
- [ ] All auth routes redirect to /login if cookie absent/invalid
- [ ] `budget_id` never accepted from client in entry creation

### Non-Functional

- [ ] PWA installable (manifest + service worker via @vite-pwa/remix + HTTPS)
- [ ] Static assets cached, API endpoints network-only
- [ ] Works on mobile (inputMode="none" on calculator, touch targets 48px minimum)
- [ ] Desktop: centered max-450px Win95 panel on teal #008080 background
- [ ] VT323 self-hosted, no border-radius anywhere in Win95 components
- [ ] JWT in httpOnly cookie, not localStorage
- [ ] Error responses never leak stack traces

### Quality Gates

- [ ] pytest: every endpoint pass + fail test
- [ ] pytest: week utils 49-combination coverage including +7 edge case
- [ ] Jest: every shared utility and component tested
- [ ] Tests use PostgreSQL not SQLite
- [ ] `npm run typecheck` passes
- [ ] Generated Route types used (not generic LoaderFunctionArgs)
- [ ] mathjs or safe parser used (not Function() constructor)

---

## Dependencies & Prerequisites

- **Custom domains on Railway** (strongly recommended — required for SameSite=Lax cookie strategy)
- **Google OAuth credentials**: Client ID + Secret; authorized redirect URI must match backend callback route exactly
- **Env vars**: DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, JWT_SECRET (32+ bytes entropy), FRONTEND_URL, BACKEND_URL (internal Railway URL for SSR)
- **VT323 woff2 font**: Download from Google Fonts, commit to `frontend/public/fonts/`
- **figma_make_one_shot/** directory present for component extraction (Phases 4-6)
- **Alembic initialized** and migration run before backend serves requests
- **Backend Dockerfile** written (currently empty — deploy blocker)

---

## ERD

```mermaid
erDiagram
    User {
        UUID id PK
        string email UK "NOT NULL"
        string name "NOT NULL"
        string google_id UK "NOT NULL, key on sub not email"
        int week_start_day "CHECK 0-6"
        datetime created_at
        datetime updated_at
    }
    Budget {
        UUID id PK
        UUID user_id FK UK "ON DELETE CASCADE"
        string name "NOT NULL"
        decimal weekly_amount "CHECK > 0, NUMERIC(12,2)"
        datetime created_at
        datetime updated_at
    }
    Entry {
        UUID id PK
        UUID user_id FK "ON DELETE CASCADE"
        UUID budget_id FK "ON DELETE CASCADE"
        decimal amount "CHECK > 0, NUMERIC(12,2)"
        string type "CHECK IN expense credit"
        text memo "nullable"
        date date
        datetime created_at
        datetime updated_at
    }
    User ||--|| Budget : "has one (v1, UNIQUE uq_budgets_user_id)"
    User ||--o{ Entry : "owns"
    Budget ||--o{ Entry : "categorizes"
```

---

## Implementation File Map

```
backend/
  requirements.txt                    <- full pinned deps (phase 1a)
  Dockerfile                          <- CURRENTLY EMPTY — must be written first
  alembic.ini
  alembic/
    env.py                            <- async runner with NullPool (phase 1e)
    versions/001_initial_schema.py    <- all tables, CHECK constraints, CASCADE, named constraints
  app/
    config.py                         <- Pydantic Settings (phase 1b)
    database.py                       <- async engine, expire_on_commit=False (phase 1c)
    models.py                         <- models with lazy="raise", PGUUID, Numeric(12,2) (phase 1d)
    main.py                           <- routers, CORS, exception handlers, /health
    dependencies.py                   <- get_current_user with algorithms=["HS256"]
    utils/
      week.py                         <- get_week_start, get_week_end
      filters.py                      <- frozenset allowlist parser
    routers/
      auth.py                         <- OAuth with state param, google-auth lib, SAVEPOINT upsert
      budget.py                       <- GET/PUT with historical warning
      entries.py                      <- CRUD, server-side budget_id, filter allowlist
      reports.py                      <- summary with max date range enforcement
  tests/
    conftest.py                       <- PostgreSQL test DB (not SQLite)
    test_week_utils.py                <- 49 combos including +7 edge case
    test_auth.py
    test_budget.py
    test_entries.py                   <- verify budget_id not accepted from client
    test_reports.py

frontend/
  public/
    manifest.json                     <- L7 branding, #000080 theme
    fonts/VT323-Regular.ttf           <- self-hosted
    icons/icon-192.png icon-512.png   <- Win95-aesthetic L7 logo
  app/
    root.tsx                          <- teal desktop bg, CRT overlay, max-450px panel
    routes.ts                         <- home, login, reports, settings
    types/
      api.ts                          <- WeekStartDay literal type, all API interfaces
    styles/
      fonts.css                       <- @font-face self-hosted VT323
    utils/
      win95.ts                        <- moved from styles/ — TypeScript module not stylesheet
      calculator.ts                   <- renamed from evalExpression; uses mathjs
      fmt.ts
      api.ts                          <- discriminated union result type
      weeks.ts                        <- +7 modulo fix, accepts Date param (no internal new Date())
      auth-guard.ts                   <- imports from api/auth.ts, forwards Cookie header
    lib/
      api.server.ts                   <- .server.ts excludes from browser bundle; internal BACKEND_URL
    components/
      W95Btn.tsx                      <- no border-radius, embossed disabled state, className prop
      PipBar.tsx                      <- memoized pip colors, inputMode="none" on parent
      EntryRow.tsx                    <- base read-only; SelectableEntryRow wraps it (composition)
      W95Dialog.tsx                   <- role="alertdialog", focus trap, Escape=Cancel
    api/
      auth.ts, budget.ts, entries.ts, reports.ts
    routes/
      login.tsx                       <- state param validation, error query param
      home.tsx                        <- frozen pendingEntry, useRef logout guard, shouldRevalidate
      reports.tsx                     <- useFetcher for range changes (prevents race condition)
      settings.tsx                    <- combined action for budget+weekStartDay, navigate after save
```

---

## Sources & References

### Internal References

- Architecture decisions: `PLANNING.md`
- UI porting guide: `PORTING_PLAN.md`
- Figma prototype: `figma_make_one_shot/src/app/components/`
- Backend stub: `backend/app/main.py:1`
- Frontend stub: `frontend/app/routes.ts:1`

### Key ADRs (from PLANNING.md)

ADR-001: PWA | ADR-002: Google OAuth + httpOnly JWT cookie | ADR-003: Online-only v1 | ADR-004: Single budget value with warning | ADR-005: Positive amounts + explicit type enum | ADR-006: Memo only | ADR-007: Single budget per user UNIQUE | ADR-008: Two Railway services | ADR-009: Error boundary throw/return | ADR-010: Dates only, week calc formula | ADR-011: Small commits | ADR-012: week_start_day int 0-6 | ADR-013: PWA branding | ADR-014: Unit tests only

### Known Bugs Fixed (from PORTING_PLAN.md)

- `calculator.ts`: replaced `Function()` with mathjs; division bug eliminated by design
- `ReportsScreen.tsx`: "THIS YEAR" option fixed (`setRange('THIS YEAR')` not `'THIS MONTH'`)

### Known Contradiction to Resolve

- `PLANNING.md` API Design section: "Authorization: Bearer" — **INCORRECT**, delete this; auth is cookie-only per ADR-002
