# L₇ (Ledger Sub 7) - UI Design Prompt

Design a mobile-first PWA called **L₇ (Ledger Sub 7)**. Generate all screens as mobile frames (375×812px or similar phone dimensions). Also generate a desktop variant of the Home Screen showing the app centered in a max 450px wide panel on a dark background.

---

## Aesthetic

**Style:** Vintage terminal / Windows 95 retro UI. Think CRT monitors, chunky bordered panels, flat pixel-accurate widgets, and the general feel of early 90s desktop software running on a dark background.

**Mood:** Utilitarian, slightly austere. This is a tool, not a lifestyle app. It should feel like something a programmer built for themselves.

**Key visual characteristics:**

- All surfaces use flat, solid colors — no gradients in UI chrome, no glassmorphism, no blur, no drop shadows
- Borders are hard 1px lines. Interactive panels (buttons, input fields, cards) use a **raised/sunken inset border effect**: lighter edge on top-left, darker edge on bottom-right — exactly like Windows 95 buttons and dialog boxes
- Buttons in their pressed/active state reverse the inset effect (sunken: dark top-left, light bottom-right)
- Subtle CRT texture or scanline overlay on the background is acceptable
- Everything feels dense and information-rich, not airy or padded

---

## Color Palette

- **Background:** Near-black (very dark gray, not pure black)
- **Surface / panel:** Slightly lighter dark gray — used for cards, input areas, dialog boxes
- **Border light edge:** Medium-light gray — the "highlight" side of the Win95 inset border
- **Border dark edge:** Darker gray — the "shadow" side of the Win95 inset border
- **Primary text:** Off-white or light gray
- **Muted / secondary text:** Dim gray — used for labels, memos, metadata
- **Accent (credits):** Cyan or teal — used exclusively to distinguish credit entries from expenses
- **Budget status colors** (used only in the pip progress bar):
  - Healthy (0–50%): Green
  - Warning (50–80%): Yellow transitioning to Orange
  - Danger (80–100%): Orange transitioning to Red
  - Over budget: Pale red → Dark red → Dark gray (see pip bar section)

---

## Typography

- **Single font family throughout:** A monospace terminal font — e.g. VT323, Share Tech Mono, or Courier Prime
- **Large numerals:** Calculator display, amounts, totals — large, prominent, monospace
- **Labels and metadata:** Smaller size, same font, dimmer color
- All-caps labels are encouraged where they reinforce the terminal aesthetic (e.g. `SPENT`, `DAYS LEFT`, `THIS WEEK`)

---

## Screens to Generate

Generate each screen as a separate mobile frame. Also generate a desktop frame for Screen 2 (Home).

---

### Screen 1 — Login

Centered vertically and horizontally on the dark background.

- App name **L₇** in very large terminal font, center of screen
- Optional subtitle in smaller caps below: `WEEKLY BUDGET TRACKER`
- Below that: a single button — `[ SIGN IN WITH GOOGLE ]` — styled as a chunky Win95-style raised button, full-width or fixed-width centered

No other content. No decorations.

---

### Screen 2 — Home (Main View)

This is the most important screen. It has three vertical sections stacked top to bottom:

1. **Header** — fixed height, budget summary + pip bar
2. **Entry History** — scrollable, fills remaining space
3. **Calculator Input** — fixed to bottom, always visible

---

#### Section 1: Header

Full-width panel at the top. Contains:

**Left side:**

- Budget figure in large monospace: e.g. `$145.50 / $200.00`
- Below that, smaller: `72%  •  3 DAYS LEFT`

**Right side:**

- Kebab menu icon `⋮` — tappable, opens a dropdown

**Below the text, spanning full width:**
The pip progress bar (see below).

---

#### Pip Progress Bar

A horizontal row of **20 equally-sized rectangular pips** with small gaps between them, spanning the full width of the header.

**Normal state (0–100% of budget spent):**

- Pips fill left to right. Each pip represents 5% of the budget.
- Filled pips are colored according to their position:
  - Pips 1–10: Green (healthy)
  - Pips 11–16: Yellow through Orange (warning)
  - Pips 17–20: Orange through Red (danger)
- Unfilled pips are dark with a subtle border — they look inactive/off
- Example state to render: 14 pips filled (70% spent), pips 15–20 dark

**Over-budget state (>100% spent) — render as a separate component variant:**

- All 20 pips are filled
- Color flows left to right: pale flat red → dark red → dark gray
- The dark gray endpoint must remain visually distinct from the background — not pure black
- The bar should feel degraded, drained, ominous — not energetic or full
- This is intentional negative reinforcement: the bar looks bad because the user overspent

The pips should look chunky and segmented — like a terminal VU meter or a retro battery indicator. No smooth gradients between pips; each pip is a solid color.

---

#### Section 2: Entry History

A scrollable list of expense/credit entries for the current week. Entries are ordered oldest at top, most recent at bottom — like a calculator tape or terminal output.

**Each entry row contains:**

- Amount (large, left-aligned, monospace): e.g. `$23.50`
- Memo text if present (smaller, muted, same row or line below): e.g. `coffee`
- Date (small, muted, right-aligned): e.g. `MON 03`
- Credit entries: amount shown in cyan accent color, with a small `[CR]` label

**Entry selected state (render as a variant):**

- Row background inverts or gets a highlight border to show selection
- Two action buttons slide in from the right edge of the row: `[ EDIT ]` and `[ DEL ]`
- Both buttons use the raised Win95 border style
- Tapping anywhere else deselects

---

#### Section 3: Calculator Input

Fixed panel anchored to the bottom of the screen. Never scrolls.

**Display line:** A single-line input display above the keypad showing the current expression, e.g. `10+5.50_`. Styled like a terminal prompt or LCD readout — dark background, light text, monospace, large font. Has a Win95 sunken/inset border.

**Above or beside the display:** A small toggle button for entry type — `[ EXPENSE ]` or `[ CREDIT ]`. Default: Expense. Shows current mode.

**Keypad — 5 rows, 4 columns:**

```
[ 7 ]  [ 8 ]  [ 9 ]  [ / ]
[ 4 ]  [ 5 ]  [ 6 ]  [ x ]
[ 1 ]  [ 2 ]  [ 3 ]  [ - ]
[ 0 ]  [ . ]  [ <- ] [ + ]
[   MEMO   ]  [    =    ]
```

- All buttons use the Win95 raised border style
- `<-` is backspace (deletes last character)
- `=` submits the expression as an entry
- `MEMO` and `=` are each double-width (span 2 columns)
- Buttons should be large — minimum 48px tall, filling available width

**Memo state (render as a separate variant of this section):**

- The keypad is hidden / slid out of view
- In its place: a text input field (sunken/inset border style), auto-focused, with the native keyboard implied below
- Above the text field: the memo label (`MEMO:`) and the current expression amount so the user knows what they're adding a memo to
- Two buttons below the text field: `[ CANCEL ]` and `[ SAVE MEMO ]`

---

### Screen 3 — Reports

Accessed via the kebab menu. Full-screen, scrollable.

**Top: Range selector**

A horizontal scrolling row of pill/chip buttons:

```
[ THIS WEEK ]  [ LAST WEEK ]  [ THIS MONTH ]  [ LAST MONTH ]  [ MORE... ]
```

- Selected chip: filled/inverted style (e.g. light background, dark text)
- Unselected chips: outlined, dark background
- `MORE...` opens a dropdown with additional options: `THIS YEAR` and `CUSTOM RANGE (COMING SOON)` (the latter shown disabled/dimmed)
- Default selected: `THIS WEEK`

**Below: Summary block**

Monospace, left-aligned, label–value pairs:

```
PERIOD:   MAR 02 – MAR 08
SPENT:    $145.50
CREDITS:  $20.00
NET:      $125.50
```

Contained in a panel with Win95 inset border.

**Below: Entry list**

Same row style as the Home Screen entry history. If the selected range spans multiple weeks, show a separator row between weeks displaying that week's subtotal, e.g.:

```
--- WEEK OF FEB 23  |  $180.00 ---
```

---

### Screen 4 — Settings

Accessed via the kebab menu.

**Fields, stacked vertically with labels above each:**

- `WEEKLY BUDGET`
  - Editable number input field (sunken/inset border)
  - Below the field, in small muted text: `Changing this affects all historical calculations`

- `WEEK STARTS ON`
  - Dropdown selector: Sunday / Monday / Tuesday / Wednesday / Thursday / Friday / Saturday
  - Styled as a Win95 dropdown (raised border, arrow indicator on right)

- `[ LOG OUT ]`
  - Full-width button, styled as a secondary/destructive action — perhaps outlined or dimmer than a primary button

---

### Dialogs

Render as floating modal dialog boxes in the center of the screen, overlaying the Home Screen. Style exactly like Windows 95 dialog boxes: a title bar at the top (with the app name or icon and title text), a content area, and a button row at the bottom.

**Dialog: Partial Cents**

- Title bar: `ATTENTION`
- Body: `Amount has more than 2 decimal places.` followed by the amount on its own line in large monospace, e.g. `$23.771`
- Buttons: `[ CANCEL ]` `[ ROUND DOWN  $23.77 ]` `[ ROUND UP  $23.78 ]`

**Dialog: Negative Result**

- Title bar: `ATTENTION`
- Body: `Result is negative.` followed by the amount on its own line in large monospace, e.g. `-$5.00`
- Buttons: `[ CANCEL ]` `[ MAKE POSITIVE  $5.00 ]` `[ ADD AS CREDIT ]`

---

### Kebab Menu Dropdown

Render as a floating context menu panel anchored to the top-right corner, overlaying the Home Screen. Style like a Win95 right-click context menu: hard border, dark background, list of items separated by thin dividers.

Items:

1. `Reports`
2. `Settings`
3. `---` (divider)
4. `Log Out`

---

## Desktop Variant (Home Screen only)

Render the Home Screen centered on a wider dark background (e.g. 1440px wide frame). The app itself sits in a centered panel no wider than 450px. The panel can optionally be styled as a terminal window or Win95 application window — with a title bar at the top reading `L₇ - LEDGER SUB 7` and the standard Win95 window chrome (minimize, maximize, close buttons in top-right).

Everything inside the panel is identical to the mobile Home Screen layout.
