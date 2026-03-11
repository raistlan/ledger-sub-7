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

/** Normal pip color (0-indexed, 0–19) */
export function getNormalPipColor(i: number): string {
  if (i < 10) return "#00cc44";
  if (i < 16) {
    const t = (i - 10) / 5;
    return `rgb(204,${lerp(204, 60, t)},0)`;
  }
  const t = (i - 16) / 3;
  return `rgb(${lerp(204, 160, t)},${lerp(60, 0, t)},0)`;
}

/** Over-budget pip color: pale flat red → dark red → dark gray */
export function getOverBudgetPipColor(i: number): string {
  const t = i / 19;
  if (t < 0.55) {
    const t2 = t / 0.55;
    return `rgb(${lerp(200, 90, t2)},${lerp(60, 0, t2)},${lerp(60, 0, t2)})`;
  }
  const t2 = (t - 0.55) / 0.45;
  const ch = lerp(90, 58, t2);
  const cg = lerp(0, 58, t2);
  return `rgb(${ch},${cg},${cg})`;
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
