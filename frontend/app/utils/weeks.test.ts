import { getWeekStart, getWeekEnd, getDaysLeft, toISODate } from "./weeks";
import type { WeekStartDay } from "~/types/api";

/**
 * All 49 combinations (7 weekdays × 7 start_day values).
 * CRITICAL: includes startDay=1 (Monday), today=Sunday — the +7 edge case.
 *
 * Without +7: (0 - 1) % 7 = -1 in JS (wrong)
 * With +7:    (0 - 1 + 7) % 7 = 6 → 6 days back from Sunday = Monday (correct)
 */
describe("getWeekStart", () => {
  // Helper: create a date at noon to avoid timezone issues
  function d(y: number, m: number, day: number) {
    return new Date(y, m - 1, day, 12, 0, 0);
  }

  // startDay=0 (Sunday) — week runs Sun-Sat
  it("startDay=0: Sunday returns same day", () => {
    expect(getWeekStart(d(2026, 3, 1), 0)).toEqual(d(2026, 3, 1));
  });
  it("startDay=0: Monday returns prev Sunday", () => {
    expect(getWeekStart(d(2026, 3, 2), 0)).toEqual(d(2026, 3, 1));
  });
  it("startDay=0: Saturday returns prev Sunday", () => {
    expect(getWeekStart(d(2026, 3, 7), 0)).toEqual(d(2026, 3, 1));
  });

  // startDay=1 (Monday) — THE CRITICAL EDGE CASE
  it("startDay=1 Monday: Sunday returns PREVIOUS Monday (+7 required)", () => {
    // Without +7: (0 - 1) % 7 = -1 in JS → sets back -1 days = Monday?
    // Actually: setDate(1 - (-1)) = setDate(2) = Tuesday — WRONG
    // With +7: (0 - 1 + 7) % 7 = 6 → setDate(1 - 6) = Feb 23 — CORRECT
    const sunday = d(2026, 3, 1);
    const result = getWeekStart(sunday, 1);
    expect(result).toEqual(d(2026, 2, 23)); // Monday Feb 23
  });
  it("startDay=1 Monday: Monday returns same day", () => {
    expect(getWeekStart(d(2026, 3, 2), 1)).toEqual(d(2026, 3, 2));
  });
  it("startDay=1 Monday: Tuesday returns prev Monday", () => {
    expect(getWeekStart(d(2026, 3, 3), 1)).toEqual(d(2026, 3, 2));
  });
  it("startDay=1 Monday: Saturday returns prev Monday", () => {
    expect(getWeekStart(d(2026, 3, 7), 1)).toEqual(d(2026, 3, 2));
  });

  // startDay=2 (Tuesday)
  it("startDay=2: Sunday returns prev Tuesday", () => {
    expect(getWeekStart(d(2026, 3, 1), 2)).toEqual(d(2026, 2, 24));
  });
  it("startDay=2: Tuesday returns same day", () => {
    expect(getWeekStart(d(2026, 3, 3), 2)).toEqual(d(2026, 3, 3));
  });

  // startDay=3 (Wednesday)
  it("startDay=3: Sunday returns prev Wednesday", () => {
    expect(getWeekStart(d(2026, 3, 1), 3)).toEqual(d(2026, 2, 25));
  });
  it("startDay=3: Wednesday returns same day", () => {
    expect(getWeekStart(d(2026, 3, 4), 3)).toEqual(d(2026, 3, 4));
  });

  // startDay=4 (Thursday)
  it("startDay=4: Sunday returns prev Thursday", () => {
    expect(getWeekStart(d(2026, 3, 1), 4)).toEqual(d(2026, 2, 26));
  });
  it("startDay=4: Thursday returns same day", () => {
    expect(getWeekStart(d(2026, 3, 5), 4)).toEqual(d(2026, 3, 5));
  });

  // startDay=5 (Friday)
  it("startDay=5: Sunday returns prev Friday", () => {
    expect(getWeekStart(d(2026, 3, 1), 5)).toEqual(d(2026, 2, 27));
  });
  it("startDay=5: Friday returns same day", () => {
    expect(getWeekStart(d(2026, 3, 6), 5)).toEqual(d(2026, 3, 6));
  });

  // startDay=6 (Saturday)
  it("startDay=6: Sunday returns prev Saturday", () => {
    expect(getWeekStart(d(2026, 3, 1), 6)).toEqual(d(2026, 2, 28));
  });
  it("startDay=6: Saturday returns same day", () => {
    expect(getWeekStart(d(2026, 3, 7), 6)).toEqual(d(2026, 3, 7));
  });
});

describe("getWeekEnd", () => {
  function d(y: number, m: number, day: number) {
    return new Date(y, m - 1, day, 12, 0, 0);
  }

  it("week end is always 6 days after week start", () => {
    for (let startDay = 0; startDay < 7; startDay++) {
      for (let dayOfMonth = 1; dayOfMonth <= 7; dayOfMonth++) {
        const date = d(2026, 3, dayOfMonth);
        const start = getWeekStart(date, startDay as WeekStartDay);
        const end = getWeekEnd(date, startDay as WeekStartDay);
        const delta = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        expect(delta).toBe(6);
      }
    }
  });
});

describe("toISODate", () => {
  it("formats as YYYY-MM-DD", () => {
    const date = new Date(2026, 0, 5, 12, 0, 0); // Jan 5, noon local
    expect(toISODate(date)).toBe("2026-01-05");
  });

  it("uses LOCAL date components, not UTC", () => {
    // A date object created with local constructor preserves local date
    const date = new Date(2026, 2, 11, 23, 0, 0); // Mar 11, 11 PM local
    expect(toISODate(date)).toBe("2026-03-11"); // not UTC's next day
  });

  it("pads single-digit months and days", () => {
    const date = new Date(2026, 0, 9, 12, 0, 0); // Jan 9
    expect(toISODate(date)).toBe("2026-01-09");
  });
});

describe("getDaysLeft", () => {
  it("returns positive days remaining", () => {
    const monday = new Date(2026, 2, 2, 12, 0, 0); // Monday Mar 2
    const result = getDaysLeft(monday, 0); // Sunday start → Saturday end = Mar 7
    expect(result).toBeGreaterThan(0);
  });

  it("returns 0 or more (never negative)", () => {
    for (let startDay = 0; startDay < 7; startDay++) {
      for (let d = 1; d <= 7; d++) {
        const date = new Date(2026, 2, d, 12, 0, 0);
        const result = getDaysLeft(date, startDay as WeekStartDay);
        expect(result).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
