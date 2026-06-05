// Win95 retro dark theme style constants for L₇ Ledger Sub 7
import type { CSSProperties } from "react";

export const C = {
  bg: "#0d0d0d",
  surface: "#1c1c1c",
  surfaceAlt: "#222222",
  borderLight: "#9a9a9a",
  borderMid: "#666666",
  borderDark: "#3a3a3a",
  text: "#d8d8d8",
  textMuted: "#686868",
  textDim: "#484848",
  cyan: "#00cccc",
  titleBar: "#000088",
  titleBarBright: "#0000aa",
  titleBarText: "#ffffff",
};

export const font = "'VT323', 'Courier New', monospace";

/** Raised Win95 border (interactive elements: buttons, cards in default state) */
export function raisedBorder(active = false): CSSProperties {
  return {
    borderStyle: "solid",
    borderWidth: 2,
    borderTopColor: active ? C.borderDark : C.borderLight,
    borderLeftColor: active ? C.borderDark : C.borderLight,
    borderBottomColor: active ? C.borderLight : C.borderDark,
    borderRightColor: active ? C.borderLight : C.borderDark,
  };
}

/** Sunken Win95 border (inputs, displays, inset panels) */
export const sunkenBorder: CSSProperties = {
  borderStyle: "solid",
  borderWidth: 2,
  borderTopColor: C.borderDark,
  borderLeftColor: C.borderDark,
  borderBottomColor: C.borderLight,
  borderRightColor: C.borderLight,
};

/** Outer panel border (dialog boxes, main windows) */
export const outerBorder: CSSProperties = {
  borderStyle: "solid",
  borderWidth: 2,
  borderTopColor: C.borderLight,
  borderLeftColor: C.borderLight,
  borderBottomColor: C.borderDark,
  borderRightColor: C.borderDark,
};

// Linear interpolation helper
export function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/**
 * How many discrete blocks of a Win95 segmented progress bar are filled.
 * @param fill  progress 0–1 (clamped)
 * @param total total number of blocks in the bar
 */
export function progressBlocks(fill: number, total: number): number {
  const clamped = Math.min(Math.max(fill, 0), 1);
  return Math.round(clamped * total);
}

/** Normal pip color (0-indexed, 0–19) */
export function getNormalPipColor(i: number): string {
  if (i <= 10) {
    // Phase 1: green → yellow across pips 0–10
    const t = i / 10;
    return `rgb(${lerp(0, 204, t)},${lerp(204, 204, t)},${lerp(68, 0, t)})`;
  }
  if (i < 16) {
    // Phase 2: yellow → orange-red across pips 10–15
    const t = (i - 10) / 5;
    return `rgb(204,${lerp(204, 60, t)},0)`;
  }
  // Phase 3: orange-red → dark red across pips 16–19
  const t = (i - 16) / 3;
  return `rgb(${lerp(204, 160, t)},${lerp(60, 0, t)},0)`;
}

/**
 * Over-budget pip color.
 * @param i - pip index (0–19)
 * @param overAmountPct - how many percent over budget (0 = exactly at 100%, 100 = double budget)
 *
 * At low overage: soft warning red. At high overage: bright alarm red.
 * Slight left→right darkening preserves the retro relief look.
 */
export function getOverBudgetPipColor(i: number, overAmountPct: number): string {
  const intensity = Math.min(overAmountPct / 100, 1);
  const baseR = lerp(170, 224, intensity);
  const baseG = lerp(40, 0, intensity);
  const posT = i / 19;
  const r = lerp(baseR, Math.round(baseR * 0.82), posT);
  const g = lerp(baseG, 0, posT);
  return `rgb(${r},${g},0)`;
}

/** CSS for CRT scanline overlay — use as inline style on a position:absolute div */
export const crtOverlay: CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage:
    "repeating-linear-gradient(0deg, rgba(0,0,0,0.07) 0px, rgba(0,0,0,0.07) 1px, transparent 1px, transparent 4px)",
  pointerEvents: "none",
  zIndex: 100,
};
