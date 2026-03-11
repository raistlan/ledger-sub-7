# L₇ (Ledger Sub 7) - UI Design Prompt

Use this document to generate UI with an AI code generation tool (e.g. v0, Lovable, Bolt).

## Tech Stack

- **Framework:** React Router v7 (SSR enabled)
- **Styling:** TailwindCSS v4 only — no component libraries (no shadcn/ui, no Radix, no MUI)
- **Platform:** Mobile-first PWA
- **No existing codebase** — generate from scratch

---

## App Overview

**Name:** Ledger Sub 7 (stylized as L₇ — L with subscript 7)

**Purpose:** Personal weekly budget tracking app. Calculator-style interface for fast expense entry.

**Platform:** Mobile-first PWA (Progressive Web App). Works on mobile and desktop, but prioritize mobile phone layout.

---

## Design Direction

**Aesthetic:** Vintage terminal / Windows 95 retro style. Think monochrome CRT displays, chunky bordered UI panels, pixelated or bitmap-style fonts, and flat colors. Reference aesthetic: [React95](https://github.com/react95-io/React95) — use this as a visual reference only, do not use it as a library.

- Dark mode only — no light mode, no system preference toggle
- Flat colors — no gradients in UI chrome, no drop shadows, no blur effects
- Hard pixel-style borders (e.g. inset/outset border style reminiscent of Win95 widgets)
- Retro terminal feel: scanline textures or subtle CRT-style background are acceptable
- No traditional nav bar — kebab menu (⋮) only for secondary navigation
- Input always visible and ready
- Fast, frictionless expense entry

---

## Typography

- **Primary font:** Monospace terminal font throughout — e.g. VT323, Share Tech Mono, or Courier Prime
- Large, bold monospace numbers for amounts (calculator display style)
- Smaller, lighter-weight monospace for labels, memos, and metadata
- All-caps or mixed-case labels are acceptable if they fit the terminal aesthetic

---

## Color Palette

- **Background:** Near-black, e.g. `#0d0d0d` or `#111111`
- **Surface / panel:** Dark gray, e.g. `#1a1a1a` or `#222222`
- **Border:** Medium gray, e.g. `#444444` — hard, 1px borders
- **Primary text:** Off-white or light gray, e.g. `#e0e0e0` or `#cccccc`
- **Muted text:** Dim gray for secondary labels and memos
- **Accent (credits):** Cyan or teal, e.g. `#00bcd4` or `#4dd0e1` — to distinguish credits from expenses
- **Budget gradient colors** (used only in the pip progress bar — see below):
  - 0–50% spent: Green, e.g. `#4caf50`
  - 50–80% spent: Yellow → Orange, e.g. `#ffeb3b` → `#ff9800`
  - 80–100% spent: Orange → Red, e.g. `#ff5722`
  - 100–300% spent: Red → Dark Red → Near-black (max at 300%)
- **Win95-style border effect:** Use inset/outset border shading (light top-left, dark bottom-right) on interactive panels and buttons to simulate the raised/sunken widget look

---

## Screens

### 1. Login Screen

Simple centered layout on the dark background:

- App logo/name: **L₇** in large terminal font
- Subtitle or tagline (optional): e.g. "WEEKLY BUDGET TRACKER"
- "Sign in with Google" button — styled retro, fits the Win95/terminal aesthetic (e.g. a chunky bordered button)
- No other content

---

### 2. Home Screen (Main Calculator View)

This is the primary screen. The layout is split into three vertical sections: header, entry history (scrollable), and calculator input (fixed at bottom).

---

#### Header Section

Spans full width at the top.

- **Top-left:** Budget summary text:
  - Spent vs Budget: e.g. `$145.50 / $200.00`
  - Percentage: e.g. `72%`
  - Days remaining: e.g. `3 DAYS LEFT`
- **Top-right:** Kebab menu icon `⋮`
- **Below the summary text:** Pip-style progress bar (see below)

---

#### Progress Bar — Pip Style

The progress bar is 20 discrete pips arranged in a horizontal row. The 20 pips represent **0–100% of the weekly budget** — one pip per 5%. This is the only place color is used to reflect budget status.

**Normal state (0–100% spent):**
- Filled pips light up left to right as spending increases
- Unfilled pips are dim/dark (background color with a subtle border)
- Each filled pip takes a color based on its position in the bar:
  - Pips 1–10 (0–50%): Green
  - Pips 11–16 (50–80%): Yellow → Orange
  - Pips 17–20 (80–100%): Orange → Red
- Example: at 72% spent, pips 1–14 are lit, pips 15–20 are dark

**Over-budget state (>100% spent):**
- All 20 pips are filled
- The pips shift to an ominous gradient left to right: pale/flat red → dark red → dark gray (not black — it must remain visually distinct from the background)
- The effect should feel like the bar is draining or dying, not filling with energy
- The pip bar should feel broken or alarming, not triumphant
- Do **not** show how far over budget the user is via the pip bar — the amount text in the header covers that
- The intent is negative reinforcement: a full degraded bar is bad, not an achievement

The effect should read like a terminal VU meter or loading bar — chunky, segmented, no smooth animation fill.

---

#### Entry History (Middle Section)

Scrollable list that grows upward like a calculator tape. Most recent entry is at the bottom.

Each entry row shows:
- **Amount** (prominent, monospace)
- **Memo** (if present — smaller, muted, same row or below amount)
- **Date** (muted, right-aligned or below)
- **Credit indicator:** Cyan accent color or a `[CR]` label for credit-type entries

**Entry selection behavior:**
- Tapping an entry highlights/selects it (e.g. inverted colors or a border highlight)
- Once selected, **Edit** and **Delete** buttons slide in from the right edge of the row
- Tapping elsewhere deselects
- No swipe required — tap to select, then tap action buttons

---

#### Calculator Input (Bottom Section — Always Visible)

Fixed to the bottom of the screen. Never scrolls away.

**Display area:** Single line showing the current input or expression (e.g. `10+5.50`). Monospace, large font. Styled like a terminal input or LCD display.

**Keypad layout:**

```
+----+----+----+----+
| 7  | 8  | 9  | /  |
+----+----+----+----+
| 4  | 5  | 6  | x  |
+----+----+----+----+
| 1  | 2  | 3  | -  |
+----+----+----+----+
| 0  | .  | <- | +  |
+----+----+----+----+
|   Memo  |    =    |
+----+----+----+----+
```

- `<-` is the backspace/clear-last key
- `=` evaluates the expression and submits as an expense entry
- **Memo** and **=** are each double-width (spanning 2 columns)
- All buttons use the Win95 raised-border style

**Type toggle (Expense / Credit):**
- A small toggle or labeled button above or beside the display area
- Default: Expense
- Toggling to Credit changes the entry type when `=` is pressed
- Credits are visually distinguished in the history list (cyan accent)

---

#### Memo Entry State

When the **Memo** button is tapped:

- The calculator keypad **slides up and collapses** (animates out of view)
- A **text input field** is revealed in its place, auto-focused, opening the native mobile keyboard
- A **confirm/done button** (e.g. `[SAVE MEMO]` or a checkmark) saves the memo text and slides the keypad back into view
- A **cancel button** discards and restores the keypad without saving
- The memo text appears on the display area while editing, so the user knows what they're typing

---

### 3. Reports Screen

Accessed from the kebab menu.

**Quick-select range picker:**

Displayed as a horizontal row of pill/chip buttons:

```
[ This Week ]  [ Last Week ]  [ This Month ]  [ Last Month ]  [ More... ]
```

- Default selected: "This Week"
- Selected chip has an active/inverted style (e.g. filled background)
- "More..." opens a dropdown with additional options (e.g. "This Year", custom range placeholder — disabled/coming soon)

**Report display (below the chips):**
- Selected date range label (e.g. `MAR 02 – MAR 08`)
- Summary block:
  - `SPENT:   $145.50`
  - `CREDITS: $20.00`
  - `NET:     $125.50`
- Scrollable list of entries for the selected range, same row style as the home screen
- If range spans multiple weeks: show a weekly subtotal row as a separator between weeks

---

### 4. Settings Screen

Accessed from the kebab menu.

**Fields:**
- **Weekly Budget Amount:** Editable number input
  - Below the field, show a warning in muted/dim text: `"Changing this affects all historical calculations"`
- **Week Starts On:** Dropdown — Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday
- **Log Out:** Button, styled as a secondary/destructive action

---

## Kebab Menu (⋮)

Appears in the top-right corner of the Home screen. Opens a dropdown with:

1. Reports
2. Settings
3. Log Out

Style: retro dropdown panel with hard borders, consistent with Win95 context menu aesthetic.

---

## Confirmation Dialogs

Dialogs should look like classic Win95 modal dialog boxes — hard borders, title bar, centered on screen.

### Partial Cents Dialog

Triggered when a result has more than 2 decimal places (e.g. `$23.771`):

```
+----------------------------------+
| ATTENTION                        |
+----------------------------------+
| Amount has more than 2 decimal   |
| places:  $23.771                 |
|                                  |
| [ Cancel ] [ Round Down $23.77 ] [ Round Up $23.78 ] |
+----------------------------------+
```

### Negative Result Dialog

Triggered when expression evaluates to a negative number (e.g. `5 - 10 = -5`):

```
+----------------------------------+
| ATTENTION                        |
+----------------------------------+
| Result is negative:  -$5.00      |
|                                  |
| [ Cancel ] [ Make Positive $5.00 ] [ Add as Credit ] |
+----------------------------------+
```

---

## Spacing & Touch Targets

- Minimum touch target: **48px** on mobile
- Calculator buttons should be large and easy to tap — prioritize tap area over decorative spacing
- On desktop, the app is centered in a max-width container of **400–500px**, styled as a phone-frame or terminal window panel

---

## Interaction Notes

- Input display auto-focused on load (calculator is always ready)
- Haptic feedback on button press (mobile)
- New entry slides into the bottom of the history list when added
- Pull-to-refresh on the entry list (syncs with server)
- Entry selection: tap to highlight, edit/delete buttons slide in from the right

---

## Mobile vs Desktop

**Mobile (Primary):**
- Full-screen layout
- Calculator input fixed to bottom (thumb-friendly)
- Native keyboard appears only during memo entry

**Desktop:**
- Centered card or terminal-window frame
- Same functionality, no layout changes beyond max-width constraint
- Max-width: 400–500px
