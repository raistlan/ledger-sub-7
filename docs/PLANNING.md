# Budget App - Technical Planning Document

This document captures architectural decisions and project scope for the budget tracking application.

## Project Overview

A personal budget tracking app with weekly budget cycles. Accessible via web browser (desktop and mobile) as a Progressive Web App.

### Core Requirements

- Set a weekly budget amount
- Log entries (expenses and credits/refunds)
- View weekly spending progress
- View monthly summaries with weekly breakdown
- Weeks run Sunday → Saturday
- Multi-user support with isolated data
- Secure authentication

## Technical Stack

| Layer | Technology |
|-------|------------|
| Frontend | React Router v7 (SSR enabled) |
| Styling | TailwindCSS v4 |
| Backend | Python FastAPI |
| Database | PostgreSQL |
| Auth | OAuth (provider TBD - likely Google) |
| Deployment | Railway |
| Mobile | PWA (Progressive Web App) |

## Architecture Decisions

### ADR-001: Progressive Web App for Mobile

**Decision:** Use PWA instead of native mobile app.

**Rationale:** Faster to ship, single codebase, installable on home screen, no app store approval needed.

### ADR-002: OAuth Authentication

**Decision:** Use OAuth (Google) for authentication.

**Rationale:** Avoids password management complexity, familiar UX for users, secure by default.

**Implementation details:**
- JWT stored in httpOnly cookie (secure, works with PWA/mobile browsers)
- Token expiry: 2 weeks, no refresh token for v1
- CSRF protection: Add as separate step after basic auth works

**Flow:**
1. Frontend redirects to Google OAuth consent
2. Google redirects back with authorization code
3. Frontend POSTs code to `/api/v1/auth/google`
4. Backend exchanges code with Google for user info
5. Backend upserts user in database
6. Backend returns JWT in httpOnly cookie

### ADR-003: Online-Only (v1)

**Decision:** No offline support in initial version.

**Rationale:** Offline sync adds significant complexity (IndexedDB, conflict resolution). Revisit if it becomes a pain point.

### ADR-004: Single Weekly Budget Value (Future-Proofed)

**Decision:** Single editable budget value, but architect for future budget history support.

**Approach:**
- Store budget in a separate `Budget` table (not directly on User)
- v1: Only one active budget per user, editing updates in place
- Show warning when editing: "This will update your budget for all historical data. Improved handling coming soon."
- Identify all code paths that would need budget-at-time logic for future implementation

**Rationale:** Keeps v1 simple while ensuring we don't paint ourselves into a corner.

### ADR-005: Entry Amount Handling

**Decision:** Always positive amounts with explicit `type` field.

**Implementation:** `amount DECIMAL` (positive) + `type ENUM('expense', 'credit')`

**Rationale:** Clearer than signed numbers, explicit intent.

### ADR-006: Memo Only, No Categories

**Decision:** No separate category field. Memo covers freeform notes; multiple budgets provide categorization later.

**Rationale:**
- Category + memo is redundant
- Multiple budgets (ADR-007) already enable categorization ("Food budget", "Entertainment budget")
- Simpler data model, simpler UI
- Users can search/filter memos if needed

### ADR-007: Single Budget per User (v1), Future-Proofed

**Decision:** One weekly budget per user in v1, but data model supports multiple budgets.

**Implementation:**
- Budget table has `name` field (defaults to "Weekly Budget")
- Entry table has `budget_id` FK from day one
- Unique constraint on `Budget.user_id` enforces single budget for now
- Auto-create default budget on user signup

**Future migration path:**
1. Drop unique constraint on `Budget.user_id`
2. Add budget creation UI
3. Add budget selector to entry form

**Rationale:** Matches current usage, but avoids painful data migration later.

### ADR-010: Week Calculation and Entry Ordering

**Decision:** Dates only (no time), frontend passes local date, backend trusts it.

**Entry ordering:** Sort by `date` ascending, then `id` ascending (insertion order within same day).

**Week boundaries:** Determined by user's `week_start_day` setting (see ADR-012). Backend provides shared utility:
```python
def get_week_start(d: date, start_day: int = 0) -> date:
    # start_day: 0=Sunday, 1=Monday, ..., 6=Saturday
    current_weekday = d.weekday()  # Monday=0, Sunday=6
    # Convert to our system where start_day=0 means Sunday
    current_day_index = (current_weekday + 1) % 7  # Sunday=0, Monday=1, ...
    days_since_start = (current_day_index - start_day) % 7
    return d - timedelta(days=days_since_start)

def get_week_end(d: date, start_day: int = 0) -> date:
    return get_week_start(d, start_day) + timedelta(days=6)
```

**"Current week" handling:** Frontend determines local date, passes to API. No timezone storage needed.

### ADR-012: Customizable Week Start Day

**Decision:** Users can configure which day their week starts (default: Sunday).

**Implementation:**
- `week_start_day` field on User table (int 0-6, default 0)
- 0=Sunday, 1=Monday, 2=Tuesday, ..., 6=Saturday
- Settings UI allows changing this preference
- All week boundary calculations use user's preference

**Why integers:**
- Enables simple modulo arithmetic for week boundary calculations
- Compact storage (single int vs string)
- Language-agnostic (no localization issues with day names like "Monday" vs "Lunes")
- Frontend maps int → display name for UI

**Rationale:** Different users have different week conventions (Sunday start vs Monday start). Personal preference that affects reporting.

### ADR-011: Small Commits

**Decision:** Development will use small, focused commits for easier review.

**Rationale:** Makes code review manageable, easier to bisect issues, clearer history.

### ADR-014: Testing Strategy

**Approach:** Unit tests only. No E2E tests - not worth the complexity for a personal app.

**Backend (Python):**
- Framework: pytest
- At least one test per function/endpoint
- Test both pass and fail cases where applicable
- Focus on: week calculation utils, API endpoint responses, validation logic

**Frontend (React):**
- Framework: Jest
- At least one test per component/hook
- Test both pass and fail cases where applicable
- Focus on: form validation, data formatting, error states

**Coverage:**
- No strict threshold
- Goal: every unit has at least one test demonstrating it works
- Prioritize testing logic over testing UI rendering

**CI:**
- Run tests before merge (can set up later)

### ADR-013: PWA Configuration

**App Identity:**
- Full name: "Ledger Sub 7"
- Short name: "L₇" (using subscript Unicode) or "Lsub7"
- Stylized as math notation: L₇ (L with subscript 7)

**Caching Strategy (v1):**
- Cache static assets (JS, CSS, images) for fast loads
- API requests always go to network (online-only for v1)

**Offline Behavior (Future):**
- Queue entries locally when offline
- Show clear visual indicator when entries are pending sync
- Display loading/error states during sync
- Make it obvious if data hasn't synced yet

**Install Prompt:**
- Use browser's default "Add to Home Screen" behavior
- Can add custom prompt later if needed

### ADR-008: Two-Service Deployment

**Decision:** Separate Railway services for frontend and backend.

**Architecture:**
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│    Backend      │────▶│   PostgreSQL    │
│  (Node.js SSR)  │     │   (FastAPI)     │     │   (Railway)     │
│  React Router   │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Rationale:** Node.js + Python in one container requires process manager complexity. Two services is cleaner, Railway handles networking, cost is usage-based not per-service.

## Data Model

**ORM:** SQLAlchemy with Pydantic models for API serialization.

```
User
├── id (UUID, PK)
├── email (unique, indexed)
├── name
├── google_id (unique, indexed) -- OAuth identifier
├── week_start_day (int, default: 0) -- 0=Sunday, 1=Monday, ..., 6=Saturday
├── created_at
└── updated_at

Budget
├── id (UUID, PK)
├── user_id (FK → User, indexed)
├── name (varchar, default: "Weekly Budget") -- for future multi-budget support
├── weekly_amount (decimal, default: 100.00)
├── created_at
└── updated_at
├── UNIQUE(user_id) -- v1: one budget per user; drop when enabling multiple budgets

Entry
├── id (UUID, PK)
├── user_id (FK → User, indexed)
├── budget_id (FK → Budget, indexed) -- future-proofed for multiple budgets
├── amount (decimal, positive)
├── type (enum: 'expense' | 'credit')
├── memo (text, nullable) -- freeform notes
├── date (date) -- the date the expense/credit applies to
├── created_at
└── updated_at

Indexes:
- entries(budget_id, date)

Future: Add entries(user_id, date) if cross-budget queries become slow.
```

**v1 Behavior:**
- User signup creates a default Budget automatically
- Entry creation uses the user's single budget (no selection UI)
- Enabling multiple budgets later: drop unique constraint, add budget picker to UI

## API Design

**Base URL:** `/api/v1`

**Authentication:** JWT tokens from Google OAuth, passed via `Authorization: Bearer <token>` header.

### Generic Filter Interface

All list endpoints support a consistent filter syntax:

```
?filter[field][operator]=value
```

**Operators:**
| Operator | Meaning |
|----------|---------|
| `eq` | Equals (default if no operator) |
| `ne` | Not equals |
| `gt` | Greater than |
| `gte` | Greater than or equal |
| `lt` | Less than |
| `lte` | Less than or equal |
| `in` | In list (comma-separated) |

**Examples:**
```
GET /entries?filter[date][gte]=2024-01-01&filter[date][lt]=2024-02-01
GET /entries?filter[type][eq]=expense
GET /entries?filter[amount][gt]=50
```

### Pagination

All list endpoints support pagination:

```
?limit=50&offset=0
```

- `limit`: Max records to return (default: 50, max: 100)
- `offset`: Number of records to skip

**Response includes pagination metadata:**
```json
{
  "data": [...],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total_count": 847
  }
}
```

**Important:** List endpoints return paginated data only. For aggregates (totals, sums), use `/reports/*` endpoints which compute on the full filtered dataset.

### Response Format

**Success (single resource):**
```json
{
  "data": { "id": "uuid", "amount": 25.00, ... }
}
```

**Success (list):**
```json
{
  "data": [...],
  "pagination": { "limit": 50, "offset": 0, "total_count": 123 }
}
```

**Error (4xx/5xx):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": [
      { "field": "amount", "reason": "Must be positive" }
    ]
  }
}
```

### Error Codes

| HTTP Status | Code | Usage |
|-------------|------|-------|
| 400 | `VALIDATION_ERROR` | Invalid input, missing fields |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Valid token but not allowed |
| 404 | `NOT_FOUND` | Resource doesn't exist |
| 409 | `CONFLICT` | Duplicate or state conflict |
| 500 | `INTERNAL_ERROR` | Server error |

### Endpoints

#### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/google` | Exchange Google OAuth code for JWT |
| POST | `/auth/refresh` | Refresh expired JWT |
| POST | `/auth/logout` | Invalidate token |
| GET | `/auth/me` | Get current user info |

#### Budget
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/budget` | Get user's budget |
| PUT | `/budget` | Update weekly amount (returns warning about historical data) |

#### Entries
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/entries` | List entries (filterable, paginated) |
| POST | `/entries` | Create entry |
| GET | `/entries/{id}` | Get single entry |
| PUT | `/entries/{id}` | Update entry |
| DELETE | `/entries/{id}` | Delete entry |

**Entry filters:** `date`, `type`, `amount`

#### Reports (Aggregates)

Reports compute on full dataset matching filters - no pagination, explicit aggregate queries.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/reports/summary` | Aggregates for date range |

**Parameters:**
- `start` (required): Start date (inclusive)
- `end` (required): End date (inclusive)
- `group_by` (optional): `week` to break down by week

**Simple summary (no grouping):**
```
GET /reports/summary?start=2024-01-14&end=2024-01-20
```
```json
{
  "data": {
    "start": "2024-01-14",
    "end": "2024-01-20",
    "budget_amount": 200.00,
    "total_spent": 145.50,
    "total_credits": 20.00,
    "net_spent": 125.50,
    "remaining": 74.50,
    "entry_count": 12
  }
}
```

**Grouped by week:**
```
GET /reports/summary?start=2024-01-01&end=2024-01-31&group_by=week
```
```json
{
  "data": {
    "start": "2024-01-01",
    "end": "2024-01-31",
    "total_spent": 650.00,
    "total_credits": 50.00,
    "groups": [
      { "start": "2024-01-07", "end": "2024-01-13", "total_spent": 145.50, "total_credits": 10.00, "entry_count": 8 },
      { "start": "2024-01-14", "end": "2024-01-20", "total_spent": 180.00, "total_credits": 15.00, "entry_count": 10 },
      ...
    ]
  }
}
```

Frontend calculates week/month boundaries using user's `week_start_day` and passes appropriate `start`/`end` to API.

## Frontend Error Handling

### ADR-009: Consistent Error Boundary Strategy

**Decision:** Single reusable ErrorBoundary component that handles all API error codes explicitly.

**Implementation:**
- Each route exports an `ErrorBoundary` using shared error handling logic
- Use React Router's `isRouteErrorResponse()` to detect structured errors
- Map error codes to user-friendly messages and appropriate UI

**Error code handling:**
| Code | UI Behavior |
|------|-------------|
| 401 | Redirect to login |
| 403 | "Access denied" message |
| 404 | "Not found" with back navigation |
| 400 | Show validation errors inline (return, not throw) |
| 500 | Generic error with retry option |

**Pattern:**
```typescript
// In loader/action: THROW for boundary, RETURN for inline
if (response.status === 404) {
  throw data(errorBody, { status: 404 }); // → ErrorBoundary
}
if (response.status === 400) {
  return data(errorBody, { status: 400 }); // → Component handles inline
}
```

**Shared utility:**
- `app/utils/error-boundary.tsx` - Reusable ErrorBoundary component
- `app/utils/api.ts` - Fetch wrapper that structures errors consistently

## Implementation Order

Build back-to-front. Never touch frontend UI until the API layer it depends on is complete and tested.

```
1. Database           (migrations, models)
2. Service / Repo     (business logic, queries)
3. API controllers    (FastAPI routes, request/response shapes)
4. Frontend API client  (typed fetch wrappers for each endpoint)
5. Frontend hooks     (data fetching, state, mutations)
6. Frontend components  (UI, wired to hooks)
```

For UI work specifically, follow `PORTING_PLAN.md` which maps the Figma Make prototype to the real app structure.

---

## UI Design

### Design Philosophy

Calculator-style app. Minimal navigation, input always ready, fast entry.

**Component approach:** Raw TailwindCSS, no component library. Full control over styling.

**Full UI porting guide:** See `PORTING_PLAN.md`.

### Screens

1. **Login**
   - Google OAuth button
   - If already authed, redirect to Home

2. **Home (Calculator View)**
   - This is the main screen, always shows current week
   - **Header:** Budget total, amount spent, remaining, days left in week. Kebab menu (⋮) top-right.
   - **Entry input:** Always visible and auto-focused. No "+" button - just type and submit.
   - **History:** Scrollable list of current week's entries (like calculator tape)
   - **Optional memo:** Expandable/popout to add memo - not required, not in the way

3. **Reports**
   - Prefilled quick-select: This week, Last week, This month, Last month, This year
   - Custom date range (future feature)
   - Shows summary + entry list for selected range

4. **Settings**
   - Weekly budget amount
   - Week start day
   - Logout

### Navigation

- No nav bar
- Kebab menu (⋮) in top-right corner with: Reports, Settings, Logout
- Login redirects to Home when authed

### Entry Input UX

**Calculator-style input:**
- Supports math operations: `+`, `-`, `*`, `/`
- User can type expressions like `10+5.50` or `25.99*2`
- Expression is evaluated on submit
- No "Add entry" button - input is always ready
- Math operators are for math only, not expense/credit type
- Use toggle for credit (rare case), not minus prefix
- If expression evaluates to negative, show confirmation with options:
  - "Result is -$5.00. Cancel / Make positive ($5.00) / Add as credit"

**Operator buttons:**
- Display four math operator buttons: `+`, `-`, `*`, `/`
- `=` button for submit (evaluates expression, creates entry)
  - Note: May need UX testing - could be confusing. Alternative: checkmark ✓ or "Add"

**Decimal handling:**
- Accept exactly what user types, no auto-formatting
- Only allow one decimal point per number
- If result has partial cents (e.g., 23.771), show confirmation:
  - "This has more than 2 decimal places. Round up / Round down / Cancel?"

**Entry flow:**
1. User types amount or expression (auto-focused input)
2. User hits `=` or Enter
3. Expression evaluated, entry added as expense by default
4. Optional: expand to add memo or toggle to credit
5. Entry appears in history list

**Type toggle:** Default is expense. Toggle button to switch to credit.

### Visual Elements

- Show days remaining in budget week
- Clear visual of: spent / budget (e.g., "$145.50 / $200.00")
- Progress indicator as percentage with dynamic gradient:
  - Green → Red as approaching 100% of budget
  - Red → Black as going over budget (>100%)
  - Gradient position calculated programmatically based on spent/budget ratio

## Open Questions

- [x] ~~ADR-004: Single budget value or budget history?~~ → Single value, warn on edit
- [x] ~~ADR-005: Confirm type field approach for entries~~ → Yes, type field
- [x] ~~Categories: Predefined list, freeform text, or user-defined?~~ → No categories, memo only (ADR-006)
- [x] ~~Do we need entry tags in addition to categories?~~ → No, memo + future multi-budget is sufficient
- [x] ~~Weekly budget: per-user or could users have multiple budgets?~~ → Single for v1, model supports multiple

## Deployment Strategy

### Railway Setup
- Two services: frontend (Node.js) + backend (Python FastAPI)
- Managed PostgreSQL addon
- Internal networking between services
- Environment variables for configuration

### Development Workflow
- Local development with Docker Compose
- Hot reload for both frontend and backend
- Shared `.env` for local secrets (not committed)
