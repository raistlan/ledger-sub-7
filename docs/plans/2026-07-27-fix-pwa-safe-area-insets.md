# Fix: calculator bottom row (MEMO / =) hidden behind the Android gesture bar

Date: 2026-07-27
Status: **implemented** — awaiting on-device confirmation

## Problem statement

On a Pixel 8 running the installed PWA, the bottom row of the calculator keypad
(`MEMO` and `=`) is not visible on load. It can only be reached by putting a
finger inside the entry list and dragging *up*, which scrolls the row into view.

`=` is the only way to commit an entry, so the app is unusable on the affected
device until the user stumbles onto the workaround gesture.

The record count is **not** involved. The entry list is `flex: 1` with
`minHeight: 0` (`frontend/app/routes/home.tsx:283`), so it absorbs all slack and
cannot push the calculator down. The original repro (0 → 1 record → external
write → refresh) was incidental — what mattered was that a refresh reset the
scroll position.

## Diagnosis

The height chain was:

- `app.css` — `.app-outer { min-height: 100vh }`, `.app-panel { height: 100vh }`
- nothing set `overflow` on `html` / `body`

so the document was exactly `100vh` tall and could scroll, and roughly 24px of
it sat outside the visible area.

A temporary instrumentation overlay (branch `worktree-viewport-debug`, not
merged) measured the device directly. The decisive reading:

```
inset bottom:  0  →  24     (on toggling viewport-fit=cover)
```

24 CSS px is exactly the Pixel 8 gesture bar. The app was rendering its bottom
24px into a region occupied by system UI, and `env()` was reporting 0 because
`viewport-fit` was at its default — so nothing in the layout could compensate.

## Approach

Two changes, which **must** ship together:

1. `root.tsx` — add `viewport-fit=cover` to the viewport meta. This is what makes
   `env(safe-area-inset-*)` report real numbers instead of 0.
2. `app.css` — inset `.app-panel` by `env(safe-area-inset-*)` on all four sides.

On its own, (1) is actively harmful: it extends the viewport *under* the system
bars and makes the clipping worse. It is only correct paired with (2).

All four sides are inset, not just the bottom. `viewport-fit=cover` expands the
viewport at every edge, so padding only the bottom would trade the clipped
keypad for a header clipped by the status bar.

### Why the shell and not the component

The inset lives on `.app-panel` in `app.css` — one rule, inherited by every
route, no component aware of it. `home`, `reports`, `settings` and `login` all
use `height: 100%; overflow: hidden` with their own inner scroll containers, so
insetting their shared container is sufficient for all of them.

`.app-panel` is already `box-sizing: border-box`, so the padding shrinks the flex
content area rather than growing the box — the panel still occupies exactly one
viewport and no document scroll is introduced.

### On the strip below the keypad

The inset region renders in `.app-panel`'s background, `C.bg` (`#0d0d0d`), while
the calculator above it is `C.surface` (`#1c1c1c`). Those are near-identical
near-blacks, so the seam is imperceptible on-device. This is why the inset can
live on the shell instead of being pushed down into each bottom-anchored
component to inherit the right colour.

## Alternatives rejected

**`svh` / `dvh` height units.** Would have fixed the case where `100vh` simply
overshoots the viewport, in two lines and with no safe-area handling. But it does
nothing when the viewport is genuinely edge-to-edge, and `inset bottom = 24`
confirms real system UI to avoid. The inset fix is correct in both cases; this
one is not. `dvh` was rejected additionally for resize jank in a browser tab —
`svh` would have been the static choice.

**`overscroll-behavior: contain` on the entry list.** Stops the drag-inside-the-
list gesture from chaining to the document. Applied before the row was visible it
removes the user's only workaround and makes the app strictly worse. Reconsider
as polish once this fix is confirmed.

**`overflow: hidden` on `html, body`.** Unnecessary — `viewport-fit=cover` makes
`100vh` equal the real viewport height, so the document overflow disappears on
its own. Skipped to keep the change minimal.

## Files affected

- `frontend/app/root.tsx` — viewport meta
- `frontend/app/app.css` — `.app-panel` insets

## Testing

No unit test accompanies this. The change is two CSS/meta declarations with no
JavaScript surface; the Jest + RTL layer (unit tests only, ADR-014) cannot
meaningfully assert on it, and a test asserting the literal text of a CSS rule
would restate the implementation rather than prove behaviour. Verified instead
against the acceptance criteria below on-device. Had the fix needed a helper
(e.g. a `safeBottom()` in `utils/win95.ts`) that helper would have been tested.

Regression checks run: `npm run typecheck`, `npm test` (75 tests), `npm run build`.

## Acceptance criteria

- [ ] Pixel 8 PWA: a cold load shows the full keypad including `MEMO` / `=`,
      with no scrolling required.
- [ ] The header and the `⋮` kebab are not clipped by the status bar at the top.
- [ ] The app does not scroll as a document — dragging in the entry list moves
      only the list.
- [ ] Desktop (≥1024px) layout is pixel-identical to before.
- [ ] `reports` and `settings` are also clear of the gesture bar.
