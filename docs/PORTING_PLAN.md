# L₇ Porting Plan — Figma Make → Real App

This document covers every artifact in `figma_make_one_shot/` and gives specific guidance on how each maps to the real frontend in `frontend/`.

---

## What the Figma Make Output Is (and Isn't)

The output is a **standalone Vite + React 18 design showcase** — a single scrolling page that renders all screens and state variants side by side inside fixed-size `MobileFrame` / `DesktopFrame` wrappers. It is not a routed application.

The real app is **React Router v7 with SSR**, TailwindCSS v4, no component libraries.

The transition involves:

1. Extracting individual screen components and wiring them to real routes
2. Replacing static mock data with API calls
3. Extracting shared primitives (W95Btn, fmt, etc.) that were duplicated across files
4. Converting inline styles to Tailwind where practical, keeping dynamic styles inline
5. Adding loading states, error handling, and auth guards that don't exist in the mockup

---

## File Inventory

### Keep and Port

| Figma file                              | Port to                     | Notes                                |
| --------------------------------------- | --------------------------- | ------------------------------------ |
| `src/app/components/win95.ts`           | `app/styles/win95.ts`       | Core design token file — port as-is  |
| `src/app/components/PipBar.tsx`         | `app/components/PipBar.tsx` | Port as-is, self-contained           |
| `src/app/components/HomeScreen.tsx`     | `app/routes/home.tsx`       | Major changes — see section below    |
| `src/app/components/LoginScreen.tsx`    | `app/routes/login.tsx`      | Minor changes — see section below    |
| `src/app/components/ReportsScreen.tsx`  | `app/routes/reports.tsx`    | Moderate changes — see section below |
| `src/app/components/SettingsScreen.tsx` | `app/routes/settings.tsx`   | Moderate changes — see section below |
| `src/styles/fonts.css`                  | `app/styles/fonts.css`      | Keep as-is                           |

### Do Not Port

| Figma file                            | Reason                                                                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/App.tsx`                     | Showcase container only — not a routed app                                                                                              |
| `src/app/components/MobileFrame.tsx`  | Showcase wrapper only                                                                                                                   |
| `src/app/components/DesktopFrame.tsx` | Showcase wrapper — desktop layout is handled differently (see below)                                                                    |
| `src/app/components/Dialogs.tsx`      | Standalone showcase versions with hardcoded amounts. The real dialog implementations are already inline in `HomeScreen.tsx` — use those |
| `src/main.tsx`                        | Vite entrypoint — replaced by React Router's SSR setup                                                                                  |
| `package.json`                        | Figma Make's own dependencies (MUI, Radix, shadcn, etc.) — none carry over                                                              |

---

## Shared Utilities to Extract First

Before porting any screen, extract these — they are currently duplicated across files and must exist as single shared modules.

### `app/styles/win95.ts`

Copy `figma_make_one_shot/src/app/components/win95.ts` verbatim. This is the design token file for the entire app:

- `C` — color palette object
- `font` — VT323 font stack string
- `raisedBorder(active?)` — Win95 raised border as `CSSProperties`
- `sunkenBorder` — Win95 sunken border as `CSSProperties`
- `outerBorder` — outer panel border as `CSSProperties`
- `crtOverlay` — scanline overlay as `CSSProperties`
- `lerp(a, b, t)` — used by pip color functions
- `getNormalPipColor(i)` — pip color for 0–100% state
- `getOverBudgetPipColor(i)` — pip color for over-budget state

### `app/components/W95Btn.tsx`

`W95Btn` is defined separately and slightly differently in `HomeScreen.tsx`, `ReportsScreen.tsx`, `SettingsScreen.tsx`, and `Dialogs.tsx`. Extract into a single shared component. The `HomeScreen` version is the most complete — it handles `active`, `disabled`, and `fullWidth` props. The `SettingsScreen` version adds a `destructive` variant. Merge all variants into one component.

### `app/utils/fmt.ts`

`fmt(n)` — formats a number to 2 decimal places with locale separators — is defined identically in all three screen files. Extract to a shared utility.

```ts
export function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
```

### `app/utils/evalExpression.ts`

The `evalExpression` function from `HomeScreen.tsx`. Extract for testability. See the **Known Bugs** section — the sanitization regex must be fixed before porting.

---

## Font Loading

`src/styles/fonts.css` contains a single line:

```css
@import url("https://fonts.googleapis.com/css2?family=VT323&display=swap");
```

In the real app, import this from the root layout or `app/root.tsx`. We want to try to self-host the font instead (better for PWA offline/performance), so should download the VT323 woff2 file and serve it as a static asset.

---

## Styling Strategy

The Figma Make output uses **100% inline `style={{}}`** via `CSSProperties` objects. The real app uses TailwindCSS v4.

**Recommended approach:** Keep dynamic styles inline, convert static styles to Tailwind.

- **Keep inline:** anything that depends on runtime values — `raisedBorder(pressed)`, pip colors, budget percentage colors, conditional backgrounds. These can't be expressed as static Tailwind classes.
- **Convert to Tailwind:** layout, padding, margin, font-size, flex direction, overflow, position. These are static and benefit from Tailwind's utility classes for consistency.
- **The `win95.ts` constants** (`C`, `raisedBorder`, `sunkenBorder`, etc.) stay as-is regardless of the Tailwind strategy — they're used inline everywhere and are the source of truth for the aesthetic.

---

## Desktop Layout

The `DesktopFrame` component in the showcase (Win95 window chrome with title bar and status bar) is showcase-only and should **not** be ported as a wrapping component.

For the real desktop layout, the PLANNING.md calls for a centered max-450px container. The visual approach from `DesktopFrame` — centered panel with `outerBorder` Win95 border and the title bar — is worth replicating as the root layout for desktop breakpoints. Extract only those visual styles, not the component itself.

The `DesktopFrame` status bar (`READY` | `WK OF MAR 02`) is a nice touch — worth carrying over as a real status bar that shows the current week label. We'll need a utility helper to get the abbreviated string of the month to populate this.

---

## Screen-by-Screen Porting Guide

---

### LoginScreen

**File:** `src/app/components/LoginScreen.tsx`

**What it does well:** Clean, complete. The logo glow effect (`textShadow` with cyan) and the `VER 1.0.0` footer are polished details worth keeping.

**Changes needed:**

1. **Remove `onLogin` prop.** Replace with a real Google OAuth redirect. The button's `onClick` should call the backend's OAuth initiation flow, not accept a prop.
2. **Add redirect guard.** The route loader should redirect to `/` (home) if the user is already authenticated. The mockup has no auth awareness.
3. **Error state.** Add a visible error message for OAuth failure (e.g., the user denies the consent screen). The mockup has no error state.

---

### HomeScreen

**File:** `src/app/components/HomeScreen.tsx`

This is the most complex screen. Most of the logic is correct directionally but needs significant changes.

**Remove entirely:**

- `initialMode` prop and all conditional logic branching on it — this was for the showcase to pre-render multiple states. In the real app, states are driven by user interaction only.
- `DEFAULT_ENTRIES` and `OVER_BUDGET_ENTRIES` static data arrays.
- `OVER_BUDGET_ENTRIES` logic in `isOverBudget` — real over-budget state comes from computed values against real data.

**State to replace with API data:**

- `entries` — loaded from `GET /api/v1/entries` filtered to the current week
- `weeklyBudget` — loaded from `GET /api/v1/budget`
- `daysLeft` — computed from the user's `week_start_day` setting and current local date

**Keep as-is:**

- `W95Btn` → after extraction to shared component, replace local definition with import
- `CalcKey` and `KeyPad` — port directly, no changes needed
- `showMemo`, `memoText`, `pendingExpr` state and memo mode UI — correct, port as-is
- `showKebab` state and kebab dropdown — port as-is
- `dialog` / `dialogAmount` state and dialog rendering — port as-is
- `DialogOverlay`, `DialogBox`, `PartialCentsDialog`, `NegativeResultDialog` — move to `app/components/` but otherwise port as-is
- Entry list rendering (selected state, EDIT/DEL buttons, day separators, CR badge) — port as-is
- Auto-scroll to bottom on new entry — port as-is
- The `commitEntry` function shape is correct, but must call `POST /api/v1/entries` instead of `setEntries`

**Date handling in `commitEntry`:**

The current implementation:

```ts
const today = new Date();
const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const dateStr = `${days[today.getDay()]} ${String(today.getDate()).padStart(2, "0")}`;
```

This display format (`MON 03`) is fine for the UI. For the API call, pass the date as `YYYY-MM-DD` (ISO format). The backend expects a `date` field in that format, not the display string.

**Navigation from kebab menu:**

Currently uses `onNavigate?.(item.screen)` prop callback. Replace with React Router's `useNavigate`:

```ts
const navigate = useNavigate();
// ...
navigate("/reports");
navigate("/settings");
```

**Logout in kebab menu:**

Currently just closes the dropdown. Wire to `POST /api/v1/auth/logout` then redirect to `/login`.

---

### Known Bugs in HomeScreen

#### Bug 1: Division is stripped from expression evaluator

`evalExpression` sanitizes the input with:

```ts
expr.replace(/x/g, "*").replace(/[^0-9+\-*.]/g, "");
```

The character class `[^0-9+\-*.]` does **not** include `/`, so division expressions like `10/2` are silently reduced to `102` before eval. The `/` key appears on the keypad but division never works.

**Fix:** Add `/` to the allowed character set:

```ts
expr.replace(/x/g, "*").replace(/[^0-9+\-*./]/g, "");
```

#### Bug 2: `evalExpression` uses `Function()` (dynamic eval)

```ts
return Function('"use strict"; return (' + sanitized + ")")() as number;
```

This is effectively `eval()`. It's acceptable here since input is user-typed calculator expressions on their own device (not remote code), and the sanitization regex limits what can reach it. But it will trigger ESLint `no-new-func` warnings. Either disable the rule for this line or replace with a proper expression parser library (e.g., `mathjs` or a tiny recursive descent parser).

---

### ReportsScreen

**File:** `src/app/components/ReportsScreen.tsx`

**Remove entirely:**

- `REPORT_ENTRIES_THIS_WEEK` and `LAST_WEEK_ENTRIES` static data arrays
- `getEntries()` function and all mock data logic
- Hardcoded `periodLabel` strings

**Replace with:**

- Load data from `GET /api/v1/reports/summary` with appropriate `start`/`end` date params and optionally `group_by=week`
- The frontend computes `start`/`end` from the selected range chip and the user's `week_start_day` setting
- The API response already provides `total_spent`, `total_credits`, `net_spent`, and optionally grouped weeks — map these directly to the summary block

**Bug: "More..." dropdown sets wrong range**

```ts
onClick={() => { setRange('THIS MONTH'); setShowMoreDropdown(false); }}
```

The "THIS YEAR" option in the dropdown incorrectly calls `setRange('THIS MONTH')`. Fix to `setRange('THIS YEAR')` and add `'THIS YEAR'` to the `Range` type union.

**`onBack` prop:**

Replace with `useNavigate()` / React Router `<Link>`. The title bar back button (`◄`) navigates to `/`.

**`W95Btn` local definition:** Replace with shared component import.
**`fmt` local definition:** Replace with shared utility import.

**`EntryRow`:** Nearly identical to the inline entry row in `HomeScreen`. Consider extracting to `app/components/EntryRow.tsx` to share between both screens. The Reports version doesn't need the selection/edit/delete behavior, so it can be the base — HomeScreen's version extends it.

---

### SettingsScreen

**File:** `src/app/components/SettingsScreen.tsx`

**Remove entirely:**

- `useState` for `budget` and `weekStart` initialized to hardcoded values

**Replace with:**

- Load current values from `GET /api/v1/budget` and `GET /api/v1/auth/me` (for `week_start_day`) in the route loader
- Save changes via `PUT /api/v1/budget` (for budget) and a user PATCH endpoint (for week start day) — or on a Save button
- Decide: save on change (live) or add an explicit save/submit button. The mockup has no save button — consider adding one since both fields have side effects.

**`onBack` prop:** Replace with `useNavigate()`.

**`onLogout` prop:** Wire to `POST /api/v1/auth/logout` then navigate to `/login`.

**`W95Btn` local definition:** Replace with shared component import.

**Week start day value:** The mockup stores the selected day as a string (`'Sunday'`, `'Monday'`, etc.). The API and database store it as an integer (0=Sunday, 1=Monday, ..., 6=Saturday). The frontend must convert between the two. The `DAYS` array in the mockup (`['Sunday', 'Monday', ...]`) already has the correct index ordering — use the array index as the integer value.

---

## Navigation Architecture

The mockup has no routing — screens are rendered side by side. The real app uses React Router v7 file-based routing.

**Suggested route structure:**

```
app/routes/
  login.tsx         ← LoginScreen
  home.tsx          ← HomeScreen (index route, requires auth)
  reports.tsx       ← ReportsScreen (requires auth)
  settings.tsx      ← SettingsScreen (requires auth)
```

**Auth guard:** All routes except `/login` require authentication. Use a React Router loader to check for the auth cookie/token and redirect to `/login` if absent.

**Back navigation in Reports and Settings:** The mockup renders a `◄` button in the Win95 title bar. In the real app, this can use `useNavigate(-1)` or simply navigate to `/`.

---

## CRT Overlay

Every screen in the mockup manually renders:

```tsx
<div style={crtOverlay} />
```

In the real app, this can be applied once at the root layout level rather than per-screen, as long as the layout wraps all routes with `position: relative; overflow: hidden`.

---

## Component Extraction Summary

Before writing any route, create these shared files:

1. `app/styles/win95.ts` — copy from `figma_make_one_shot/src/app/components/win95.ts`
2. `app/styles/fonts.css` — copy from `figma_make_one_shot/src/styles/fonts.css`
3. `app/components/W95Btn.tsx` — merge all local `W95Btn` definitions into one component with `active`, `disabled`, `fullWidth`, and `destructive` props
4. `app/components/PipBar.tsx` — copy from `figma_make_one_shot/src/app/components/PipBar.tsx`, update import path for `win95.ts`
5. `app/components/EntryRow.tsx` — extract the entry row from `ReportsScreen.tsx` as the base, extend for the selectable variant used in `HomeScreen`
6. `app/components/W95Dialog.tsx` — extract `DialogOverlay`, `DialogBox`, `PartialCentsDialog`, `NegativeResultDialog` from `HomeScreen.tsx`
7. `app/utils/fmt.ts` — single `fmt(n)` export
8. `app/utils/evalExpression.ts` — with the division bug fixed
