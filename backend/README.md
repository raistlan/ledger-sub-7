# L₇ Backend

The FastAPI backend for Ledger Sub 7. Provides a JSON REST API for authentication, budget management, expense/credit entries, and weekly spend reports. Runs on Python with an async SQLAlchemy + PostgreSQL stack.

For full project setup (database, frontend, OAuth), see the [root README](../README.md).

## Tech

- **FastAPI** — async HTTP framework with automatic OpenAPI docs (`/docs`)
- **SQLAlchemy 2 (asyncio)** — async ORM with `asyncpg` driver
- **Alembic** — schema migrations
- **pydantic-settings** — config via `.env` file and environment variables
- **PyJWT + Google OAuth 2.0** — authentication
- **slowapi** — rate limiting
- **pytest + pytest-asyncio** — async test suite

## Getting Started

Activate the virtual environment and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file in this directory:

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/l7_dev
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/auth/callback
JWT_SECRET=any-random-secret-string
JWT_EXPIRE_DAYS=14
FRONTEND_URL=http://localhost:5173
ENVIRONMENT=development
```

> **Note:** The local Docker database uses host port **5433** (see `docker-compose.yml` in the project root).

Run migrations and start the server:

```bash
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

OpenAPI docs are available at **http://localhost:8000/docs**.

## Running Tests

The test suite uses a separate database. Create it once:

```bash
docker exec $(docker compose ps -q db) createdb -U postgres l7_test
```

Run tests:

```bash
TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/l7_test pytest
```

## Project Structure

```
backend/
├── app/
│   ├── main.py          # FastAPI app entry, middleware, router registration
│   ├── config.py        # Settings (pydantic-settings, reads .env)
│   ├── database.py      # Async engine and session factory
│   ├── models.py        # SQLAlchemy ORM models (User, Budget, Entry)
│   ├── dependencies.py  # Auth dependency: get_current_user
│   ├── limiter.py       # Rate limiting setup (slowapi)
│   └── routers/
│       ├── auth.py      # Google OAuth callback + /auth/me
│       ├── entries.py   # Expense/credit CRUD (/entries)
│       ├── budget.py    # Weekly budget GET/PUT (/budget)
│       └── reports.py   # Summary reports (/reports)
├── modules/             # Domain logic separated from HTTP layer
│   ├── entry/
│   ├── account/
│   └── user/
├── alembic/             # Migration scripts
├── alembic.ini
├── tests/
│   ├── conftest.py      # Async test client, test DB fixtures
│   ├── test_auth.py
│   ├── test_entries.py
│   ├── test_budget.py
│   ├── test_reports.py
│   └── test_week_utils.py
├── Dockerfile
└── requirements.txt
```

## API Overview

All routes are prefixed with `/api/v1`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/login` | Redirect to Google OAuth |
| GET | `/auth/callback` | OAuth callback; sets JWT cookie |
| GET | `/auth/me` | Current user info |
| POST | `/auth/logout` | Clear JWT cookie |
| GET | `/entries` | List entries (filterable by date range) |
| POST | `/entries` | Create entry |
| PUT | `/entries/{id}` | Update entry |
| DELETE | `/entries/{id}` | Delete entry |
| GET | `/budget` | Get weekly budget |
| PUT | `/budget` | Update weekly budget |
| GET | `/reports` | Weekly spend summaries |
