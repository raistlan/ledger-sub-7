# CLAUDE.md

This file provides guidance to Claude Code when working in this repository. These rules are non-negotiable — follow them exactly.

---

## Project Overview

**Ledger Sub 7 (L₇)** is a retro Win95-styled weekly budget tracker. Log expenses/credits, watch a pip bar fill up, review historical spend reports. Dark-mode, monospace aesthetic throughout.

- **Frontend:** React Router v7 (SSR) + Vite + TypeScript + TailwindCSS v4
- **Backend:** FastAPI + SQLAlchemy (asyncio) + Alembic + PostgreSQL 16
- **Auth:** Google OAuth 2.0 + JWT httpOnly cookies
- **Deployment:** Railway (two separate services — frontend Node.js, backend Python)
- **Mobile:** PWA (Progressive Web App)

---

## Commands

### Frontend (run from `frontend/`)

```bash
npm install          # Install dependencies
npm run dev          # Dev server with HMR → http://localhost:5173
npm run build        # Production build
npm run typecheck    # Run React Router typegen + tsc
npm test             # Run Jest tests
```

Requires `frontend/.env`:
```
BACKEND_URL=http://localhost:8000
```

### Backend (run from `backend/`)

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

alembic upgrade head                         # Run migrations
uvicorn app.main:app --reload --port 8000    # Dev server → http://localhost:8000
```

OpenAPI docs: `http://localhost:8000/docs`

Requires `backend/.env` — see `backend/README.md` for the full template.

### Database

```bash
docker compose up -d    # Start PostgreSQL on host port 5433
```

### Backend Tests

```bash
# Create test DB once
docker exec $(docker compose ps -q db) createdb -U postgres l7_test

# Run tests
TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/l7_test pytest
```

---

## Rules

### 1. Keep a Plan for Every Significant Change

Before starting any non-trivial task (new feature, refactor, bug fix with multiple moving parts), create a plan file at:

```
docs/plans/YYYY-MM-DD-<type>-<short-slug>.md
```

Plan files must include:
- **Problem statement** — what's broken or missing and why it matters
- **Approach** — the solution strategy with key decisions called out
- **Files affected** — list every file that will change
- **Acceptance criteria** — how to know the work is done

Do not start writing code until the plan is agreed upon. Update the plan as understanding changes — it is a living document, not just a pre-work artifact.

### 2. Testing Strategy

**Unit tests only. No E2E.** (ADR-014)

**Write tests first.** Before implementing a function, endpoint, or hook, write the test that defines what "correct" looks like. This forces the interface to be designed before the internals, catches ambiguity in the spec early, and means the implementation is done when the tests pass — not when it "looks right."

The order is: write a failing test → implement until it passes → refactor.

**Backend (pytest):**
- At least one test per endpoint and per utility function
- Test both success and failure cases where non-trivial
- Focus on: week calculation utilities, API endpoint responses, validation logic
- Run with a real test database — do not mock the database layer

**Frontend (Jest + React Testing Library):**
- At least one test per custom hook and utility function
- Components: test behaviour, not rendering snapshots
- Focus on: form validation, data formatting, error states, hook logic
- Test files live next to the source file (e.g., `utils/weeks.test.ts`)

**Coverage:** No hard threshold. Goal: every unit has at least one test proving it works.

New code without tests is incomplete. Existing code being modified should gain tests if it doesn't have them.

### 3. Component and Hook Organization

Route files are orchestration only. Do not let them grow into monoliths.

- **Logic → hooks:** Any stateful or side-effectful logic that can be named belongs in `frontend/app/hooks/`
- **UI → components:** Any reusable or sufficiently complex JSX belongs in `frontend/app/components/`
- **Utilities → utils:** Pure functions (no React) belong in `frontend/app/utils/`
- **Types → types/api.ts:** Shared TypeScript types for API shapes

If a route file exceeds ~200–300 lines, it almost certainly needs to be broken up.

### 4. Build Back-to-Front

Never touch frontend UI for a feature until the API it depends on is complete and tested.

Order:
1. Database (migration, model)
2. Business logic (backend module or router utility)
3. API route (FastAPI router, request/response shapes)
4. Frontend API client (`lib/api.server.ts`)
5. Frontend hooks
6. Frontend components/route

### 5. Small, Focused Commits (ADR-011)

Each commit should do one thing. A migration, a router change, a component extraction — not all at once. This makes review and bisect tractable.

---

## Project Structure

```
ledger-sub-7/
├── docker-compose.yml       # Local PostgreSQL (host port 5433)
├── docs/
│   ├── PLANNING.md          # ADRs and architectural decisions (authoritative)
│   ├── PORTING_PLAN.md      # UI porting guide from Figma prototype
│   ├── plans/               # Per-task plan files (YYYY-MM-DD-type-slug.md)
│   └── todos/               # Granular todo items (NNN-status-priority-slug.md)
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI entry, middleware, router registration
│   │   ├── config.py        # pydantic-settings (reads .env)
│   │   ├── database.py      # Async engine + session factory
│   │   ├── models.py        # SQLAlchemy ORM: User, Budget, Entry
│   │   ├── dependencies.py  # Auth dependency (get_current_user)
│   │   ├── limiter.py       # slowapi rate limiting
│   │   └── routers/         # One file per resource: auth, entries, budget, reports
│   ├── modules/             # Domain logic separated from the HTTP layer
│   ├── alembic/             # Migration scripts
│   ├── tests/               # pytest async test suite
│   └── requirements.txt
└── frontend/
    └── app/
        ├── routes/          # Route components (loaders, actions, UI)
        ├── components/      # Reusable UI components
        ├── hooks/           # Custom React hooks
        ├── lib/             # Server-side fetch client
        ├── types/           # Shared TypeScript types
        └── utils/           # Pure utilities (calculator, fmt, weeks, win95)
```

---

## Architecture Notes

### Frontend Patterns

**Win95 Styling:** Use `utils/win95.ts` constants (`C`, `font`, border helpers) for all UI. Do not hardcode hex colors or font names inline — go through the utility.

**Dialog State Machine:** Modal state is managed as a single `dialogPhase` string union, not separate open/close booleans. When adding a new dialog, extend the union — don't introduce a new independent boolean.

**Deferred Loading:** Use React Router's `<Await>` + `<Suspense>` for data that can load progressively. Parallelize critical data fetches; defer anything non-blocking.

**Edit via useFetcher:** Entry edits use `useFetcher` (not navigation) so the URL doesn't change. See `hooks/useEditEntryDialog.ts` for the pattern.

**Date Handling:** The frontend determines the user's local date and passes it to the API as `YYYY-MM-DD`. The backend trusts it. Never use `new Date()` server-side to determine "today" — use `useLocalToday` hook in the browser or read the session date cookie in SSR loaders.

**Calculator Input:** `utils/calculator.ts` evaluates math expressions. If the result is negative, a confirmation dialog fires. If it has >2 decimal places, a rounding dialog fires. Both are handled in the `home.tsx` dialog state machine.

### Backend Patterns

**Authentication:** JWT stored in httpOnly cookie. `get_current_user` dependency in `dependencies.py` validates it on protected routes.

**Week Boundaries:** `app/utils/week.py` provides `get_week_start()` and `get_week_end()` — always use these, never inline the modulo arithmetic.

**Entry Ordering:** `ORDER BY date ASC, created_at ASC` — date first, then insertion order within the same day.

**Modules vs Routers:** HTTP request/response handling belongs in `routers/`. Business logic (validation, aggregation, domain rules) belongs in `modules/`. When a router starts accumulating domain logic, move it.

**API Shape:** All endpoints return `{ "data": ... }` for success and `{ "error": { "code": ..., "message": ..., "details": [...] } }` for errors. Follow this envelope — do not return bare objects.

### Data Model

```
User      — id, email, name, google_id, week_start_day (0=Sun…6=Sat)
Budget    — id, user_id, name, weekly_amount, UNIQUE(user_id) for v1
Entry     — id, user_id, budget_id, amount, type (expense|credit), memo, date, created_at
```

Weeks run from the user's configured `week_start_day`. All week boundary logic must respect this setting.

---

## Key Reference Docs

- `docs/PLANNING.md` — All ADRs and architectural decisions. Read before proposing structural changes.
- `docs/PORTING_PLAN.md` — UI porting guide (Win95 component patterns, known bugs, screen layouts).
- `backend/README.md` — Backend setup, env vars, test DB setup.
- `frontend/README.md` — Frontend patterns, styling conventions, testing setup.
