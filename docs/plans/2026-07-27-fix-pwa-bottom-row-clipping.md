# Fix: calculator bottom row (MEMO / =) clipped in mobile PWA

Date: 2026-07-27
Status: **diagnosing** — instrumentation landed, fix not yet chosen

## Problem statement

On a Pixel 8 running the installed PWA, the bottom row of the calculator keypad
(`MEMO` and `=`) is not visible on load. The user can only reach it by putting a
finger inside the entry list and dragging *up*, which scrolls the row into view.

Without `=` there is no way to commit an entry, so the app is unusable on the
affected device until the user discovers the workaround gesture.

Reproduced by the user on a plain page refresh. The record count is **not**
causally involved — the entry list is `flex: 1` with `minHeight: 0`
(`frontend/app/routes/home.tsx:283`), so it absorbs all slack and cannot push
the calculator down. The original repro (0 → 1 record → external write →
refresh) is incidental; what matters is that a refresh resets document scroll.

## Root cause — two candidates

The height chain is:

- `frontend/app/app.css:20` — `.app-outer { min-height: 100vh }`
- `frontend/app/app.css:49` — `.app-panel { height: 100vh; overflow: hidden }`
- nothing sets `overflow` on `html` / `body`

so the document is exactly `100vh` tall and **the document itself can scroll**.
`overflow: hidden` on `.app-panel` constrains its children, not the page.

**Case A — edge-to-edge viewport.** Android 15 / recent Chrome renders installed
PWAs edge-to-edge. The layout viewport extends behind the gesture bar, so
`vh`/`svh`/`dvh`/`lvh` are all equal to the full screen height and the bottom
~24–48px of content is *covered* by system UI rather than off-screen.

**Case B — `100vh` overshoots the real viewport.** `100vh` resolves larger than
`window.innerHeight`, giving the document genuine scrollable overflow. The row
is *below* the window, not under the bar.

These need different fixes and cannot be distinguished from the code alone.

## Diagnostic

`frontend/app/components/ViewportDebug.tsx` — a temporary fixed overlay,
mounted in `root.tsx`, that reports live:

- `window.scrollY`, and **max `scrollY` observed** (the decisive number)
- document scrollable overflow (`scrollHeight - clientHeight`)
- `innerHeight`, `documentElement.clientHeight`, `visualViewport.height`
- what `100vh` / `100svh` / `100lvh` / `100dvh` actually resolve to, measured
  with a probe element
- `env(safe-area-inset-top / bottom)`
- `display-mode: standalone`, devicePixelRatio

It also has a button that flips `viewport-fit=cover` on the viewport meta at
runtime. `viewport-fit` is **left at the default on load** deliberately — setting
it would expand the layout viewport and mask case B, contaminating the baseline.

Readings are also `console.log`ged, and `window.__vp()` dumps a snapshot on
demand for remote-debugging sessions.

### Reading the result

| Observation | Case | Fix |
| --- | --- | --- |
| max `scrollY` > 0 | **B** | `svh` height fix (below) |
| max `scrollY` stays 0, row still covered | **A** | safe-area insets (below) |

## Candidate fixes

**B — height units (2 lines, preferred if it applies).** In `app.css`, give
`.app-outer` / `.app-panel` an `svh` height with a `vh` fallback, and set
`overflow: hidden` on `html, body`. `svh` is a *static* unit — it never changes
value, so unlike `dvh` there is no resize jank in a browser tab. No component
changes, no safe-area handling, no effect on desktop (all four units are equal
where there is no retractable browser chrome).

**A — safe-area insets.** Add `viewport-fit=cover` to the viewport meta in
`root.tsx` and `padding-bottom: env(safe-area-inset-bottom, 0px)` to
`.app-panel` in `app.css`. `.app-panel` is already `box-sizing: border-box`, so
the padding correctly shrinks the flex content area rather than growing the box.
Shell-level, so every route inherits it — no per-component styling.

Notes on A:
- `viewport-fit=cover` **must** ship together with the padding. On its own it
  expands the viewport under the system bars and makes the clipping worse.
- The inset strip renders in `.app-panel`'s background (`C.bg`, dark), giving a
  thin dark band below the grey calculator surface. Moving the inset onto the
  calculator instead would let `C.surface` bleed into it — an aesthetic call.
- If orientation is ever unlocked (manifest is `portrait` today), left/right
  insets would need handling too for notched devices in landscape.

A also happens to fix case B as a side effect (`cover` makes `100vh ==
innerHeight`, so the document stops scrolling). B's fix does **not** fix case A.
So A is the universal option; the diagnostic exists to find out whether the
cheaper B fix is sufficient.

**Rejected: `overscroll-behavior: contain` on the entry list.** It would stop
the drag-inside-the-list gesture from chaining to the document. But applied
before the row is visible it removes the user's only workaround and makes the
app strictly worse. Optional polish *after* a real fix, not part of it.

## Files affected

Diagnostic (temporary, revert before merge):
- `frontend/app/components/ViewportDebug.tsx` (new)
- `frontend/app/root.tsx` (mount)

Fix (once case is known):
- `frontend/app/app.css`
- `frontend/app/root.tsx` (viewport meta — case A only)

## Acceptance criteria

- On the Pixel 8 PWA, a cold load shows the full keypad including `MEMO` / `=`
  with no scrolling.
- Max `scrollY` stays 0 on a fresh load — the document does not scroll at all.
- Desktop (≥1024px) layout is visually unchanged.
- The `ViewportDebug` component and its mount are removed.

## Testing

The diagnostic component is deliberately untested — it is instrumentation, is
not shipping, and only reads DOM geometry. The fix itself is CSS-only, which the
unit-test layer (Jest + RTL, per ADR-014) cannot meaningfully assert on; it is
verified on-device against the acceptance criteria above. Any helper introduced
alongside it (e.g. a `safeBottom()` in `utils/win95.ts`) gets a unit test.
