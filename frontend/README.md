# L₇ Frontend

The React Router v7 frontend for Ledger Sub 7 — a retro Win95-styled weekly budget tracker. Renders server-side, communicates with the FastAPI backend via an internal server-side API client, and presents a dark-mode, monospace calculator UI.

For full project setup (database, backend, OAuth), see the [root README](../README.md).

## Tech

- **React Router v7** — file-based routing with SSR, loaders, and actions
- **Vite** — development server with HMR, production bundler
- **TypeScript** — strict mode enabled
- **TailwindCSS v4** — utility classes available; most styling is inline via `utils/win95.ts` constants
- **Jest + @testing-library/react** — unit and component tests

## Getting Started

```bash
npm install
```

Create a `.env` file in this directory:

```env
BACKEND_URL=http://localhost:8000
```

Start the dev server:

```bash
npm run dev        # http://localhost:5173 with HMR
```

Other commands:

```bash
npm run build      # Production build (outputs to build/)
npm run start      # Serve the production build
npm run typecheck  # TypeScript type check (runs react-router typegen first)
npm test           # Run Jest tests
```

## Project Structure

```
app/
├── routes.ts              # Route manifest (maps URLs to route files)
├── root.tsx               # Root layout, global error boundary
├── routes/
│   ├── home.tsx           # Main calculator + entry list + dialogs
│   ├── login.tsx          # Google OAuth redirect
│   ├── logout.ts          # Clears JWT cookie and redirects
│   ├── settings.tsx       # Budget and week-start-day settings
│   ├── reports.tsx        # Historical weekly spend reports
│   └── $.tsx              # 404 catch-all
├── components/
│   ├── W95Dialog.tsx      # DialogOverlay + DialogBox base + PartialCentsDialog + NegativeResultDialog
│   ├── EditEntryDialog.tsx # Edit entry form dialog
│   ├── EntryRow.tsx       # Entry list row (interactive + read-only variants)
│   ├── PipBar.tsx         # Win95 pip-style budget progress bar
│   ├── W95Btn.tsx         # Win95 raised/active button
│   └── SessionExpiredBoundary.tsx  # Catches 401s and redirects to login
├── hooks/
│   └── useEditEntryDialog.ts  # useFetcher-backed hook for edit dialog state
├── lib/
│   └── api.server.ts      # Server-side HTTP client (wraps fetch, attaches cookies)
├── types/
│   └── api.ts             # Shared TypeScript types (Entry, Budget, User, …)
└── utils/
    ├── win95.ts           # Color palette, fonts, border helpers (C, font, raisedBorder, sunkenBorder)
    ├── calculator.ts      # Expression evaluator (evalExpression)
    ├── fmt.ts             # Currency formatter
    └── weeks.ts           # Week boundary and date label utilities
```

## Key Patterns

### Win95 styling
All visual styling is done with inline styles using constants from `utils/win95.ts`. `C` is the color palette, `font` is the monospace stack, and `raisedBorder`/`sunkenBorder` return `CSSProperties` objects for the beveled Win95 look. TailwindCSS is available but not used for the core UI.

### Route data flow
Each route exports a `loader` (reads data) and optionally an `action` (handles mutations). The backend API client lives in `lib/api.server.ts` — it runs server-side only, attaches the JWT cookie from the incoming request, and throws on non-2xx responses.

### Dialog state machine
`home.tsx` uses a single `dialogPhase` string (`"none" | "negative" | "partial_cents" | "edit"`) rather than multiple booleans to prevent impossible states. Each dialog phase maps to exactly one rendered dialog.

### Edit dialog (useFetcher)
The edit dialog uses `useFetcher` (via `useEditEntryDialog`) rather than `useSubmit` so the page doesn't navigate on submission. `fetcher.reset()` is called on close to prevent stale state on re-open.
