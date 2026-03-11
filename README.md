<p align="center">
  <img src="frontend/public/icons/icon-192.png" alt="Ledger Sub 7 Logo" />
</p>

# Ledger Sub 7

A retro Win95-styled weekly budget tracker. Track expenses and credits, visualize your weekly spend with a pip bar, and review historical reports.

## Stack

- **Backend**: FastAPI + SQLAlchemy (asyncio) + PostgreSQL + Alembic
- **Frontend**: React Router v7 (SSR) + Vite + TypeScript
- **Auth**: Google OAuth 2.0 + JWT cookies

## Prerequisites

- Python 3.11+
- Node.js 18+
- Docker (for local PostgreSQL)
- A Google Cloud project with OAuth 2.0 credentials

## Setup

### 1. Clone and checkout

```bash
git clone git@github.com:raistlan/ledger-sub-7.git
cd ledger-sub-7
git checkout worktree-compound-one-shot
```

### 2. Start the database

```bash
docker compose up -d
```

This starts a PostgreSQL 16 instance on `localhost:5432` with database `l7_dev`. Data persists in a Docker volume across restarts.

### 3. Configure the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/l7_dev
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/auth/callback
JWT_SECRET=any-random-secret-string
JWT_EXPIRE_DAYS=14
FRONTEND_URL=http://localhost:5173
ENVIRONMENT=development
```

Run migrations:

```bash
alembic upgrade head
```

Start the backend:

```bash
uvicorn app.main:app --reload --port 8000
```

### 4. Configure the frontend

```bash
cd ../frontend
npm install
```

Create `frontend/.env`:

```env
BACKEND_URL=http://localhost:8000
```

Start the frontend:

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

# Create a test database (requires Docker to be running)
docker exec $(docker compose ps -q db) createdb -U postgres l7_test

TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/l7_test pytest
```

### Frontend

```bash
cd frontend
npm test
```

## Deploying to Railway

Railway works out of the box — the backend reads all config from environment variables.

1. Create a new Railway project
2. Add a **PostgreSQL** plugin — Railway automatically sets `DATABASE_URL`
3. Deploy the `backend/` directory; Railway will detect the `Dockerfile`
4. Set these environment variables in Railway:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=https://your-backend.railway.app/api/v1/auth/callback
   JWT_SECRET=...
   FRONTEND_URL=https://your-frontend.railway.app
   ENVIRONMENT=production
   ```
5. After deploy, run migrations once via Railway's shell:
   ```bash
   alembic upgrade head
   ```
6. Deploy the `frontend/` directory as a separate Railway service, setting:
   ```
   BACKEND_URL=https://your-backend.railway.app
   ```

> **Note:** Update the Google OAuth redirect URI in Google Cloud Console to match your Railway backend URL.

## Project Structure

```
ledger-sub-7/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app entry point
│   │   ├── config.py        # Settings (reads .env)
│   │   ├── models.py        # SQLAlchemy models
│   │   ├── dependencies.py  # Auth dependency (get_current_user)
│   │   └── routers/
│   │       ├── auth.py      # Google OAuth + /me
│   │       ├── entries.py   # Expense/credit CRUD
│   │       ├── budget.py    # Weekly budget
│   │       └── reports.py   # Summary reports
│   ├── alembic/             # Database migrations
│   ├── tests/               # pytest test suite
│   └── requirements.txt
└── frontend/
    ├── app/
    │   ├── routes/          # home, login, logout, settings, reports
    │   ├── components/      # PipBar, W95Btn, W95Dialog, EntryRow
    │   └── utils/           # calculator, fmt, weeks, win95 theme
    └── package.json
```
