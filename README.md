<p align="center">
  <img src="frontend/public/icons/icon-192.png" alt="Ledger Sub 7 Logo" />
</p>

# Ledger Sub 7

A retro Win95-styled weekly budget tracker. Log expenses and credits, watch a pip bar fill up, and review historical spend reports — all in a dark-mode, monospace aesthetic.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Router v7 (SSR) + Vite + TypeScript |
| Styling | TailwindCSS v4 + custom Win95 theme (`win95.ts`) |
| Backend | FastAPI + SQLAlchemy (asyncio) + Alembic |
| Database | PostgreSQL 16 |
| Auth | Google OAuth 2.0 + JWT cookies |

## Prerequisites

- Python 3.11+
- Node.js 18+
- Docker (for local PostgreSQL)
- A Google Cloud project with OAuth 2.0 credentials

## Local Setup

### 1. Start the database

```bash
docker compose up -d
```

Starts a PostgreSQL 16 instance. Host port is **5433**, container port is 5432. Data persists in a Docker volume across restarts.

### 2. Configure the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

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

Run migrations and start the server:

```bash
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### 3. Configure the frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
BACKEND_URL=http://localhost:8000
```

Start the dev server:

```bash
npm run dev
```

The app is now running at **http://localhost:5173**.

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add `http://localhost:8000/api/v1/auth/callback` as an **Authorized redirect URI**
4. Copy the Client ID and Secret into `backend/.env`

## Running Tests

### Backend

```bash
cd backend
source .venv/bin/activate

# Create the test database (requires Docker to be running)
docker exec $(docker compose ps -q db) createdb -U postgres l7_test

TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/l7_test pytest
```

### Frontend

```bash
cd frontend
npm test
```

## Deployment (Railway)

Railway reads all config from environment variables and works with both sub-directories.

1. Create a new Railway project
2. Add a **PostgreSQL** plugin — Railway sets `DATABASE_URL` automatically
3. Deploy `backend/` as a service; Railway detects the `Dockerfile`
4. Set these environment variables on the backend service:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=https://your-backend.railway.app/api/v1/auth/callback
   JWT_SECRET=...
   FRONTEND_URL=https://your-frontend.railway.app
   ENVIRONMENT=production
   ```
5. Run migrations once via Railway's shell: `alembic upgrade head`
6. Deploy `frontend/` as a separate service with:
   ```
   BACKEND_URL=https://your-backend.railway.app
   ```

Update the Google OAuth redirect URI in Google Cloud Console to match your Railway backend URL.

## Project Structure

```
ledger-sub-7/
├── docker-compose.yml       # Local PostgreSQL (host port 5433)
├── docs/                    # Planning docs and design notes
├── backend/                 # FastAPI application → see backend/README.md
│   ├── app/
│   │   ├── main.py          # Entry point, middleware, router registration
│   │   ├── config.py        # Settings (reads .env via pydantic-settings)
│   │   ├── models.py        # SQLAlchemy ORM models
│   │   ├── dependencies.py  # Auth dependency (get_current_user)
│   │   ├── limiter.py       # Rate limiting (slowapi)
│   │   └── routers/         # auth, entries, budget, reports
│   ├── modules/             # Domain logic (entry, account, user)
│   ├── alembic/             # Database migrations
│   ├── tests/               # pytest async test suite
│   └── requirements.txt
└── frontend/                # React Router v7 app → see frontend/README.md
    └── app/
        ├── routes/          # home, login, logout, settings, reports
        ├── components/      # UI components (W95Dialog, EntryRow, PipBar, …)
        ├── hooks/           # Custom React hooks (e.g. useEditEntryDialog)
        ├── lib/             # Server-side API client
        ├── types/           # Shared TypeScript types
        └── utils/           # Pure utilities (calculator, fmt, weeks, win95)
```
