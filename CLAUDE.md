# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack application with a React Router frontend and a Python (FastAPI) backend.

## Project Structure

```
ledger-sub-7/
├── frontend/          # React Router v7 application
│   └── app/           # Application code
│       ├── routes/    # Route components
│       └── welcome/   # Welcome page assets
└── backend/           # Python FastAPI backend
    ├── app/           # FastAPI application
    └── modules/       # Business logic modules
```

## Commands

### Frontend (run from `frontend/` directory)

```bash
npm install          # Install dependencies
npm run dev          # Start dev server with HMR (localhost:5173)
npm run build        # Production build
npm run start        # Start production server
npm run typecheck    # Run TypeScript type checking
```

### Backend (run from `backend/` directory)

Dependencies are managed via `requirements.txt`. Use a virtual environment.

## Architecture

### Frontend

- **Framework**: React Router v7 with server-side rendering enabled
- **Bundler**: Vite with TailwindCSS v4
- **Routing**: File-based routing configured in `app/routes.ts`
- **Type Generation**: React Router generates types in `.react-router/types/`
- **Path Aliases**: `~/*` maps to `./app/*`

### Backend

- **Framework**: FastAPI (Python)
- **Structure**: Application entry in `app/main.py`, dependencies in `app/dependencies.py`, business logic in `modules/`
