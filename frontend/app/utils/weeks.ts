import type { WeekStartDay } from "~/types/api";

export function getWeekStart(d: Date, startDay: WeekStartDay = 0): Date {
  const dayIndex = d.getDay(); // 0=Sunday, matches Python's current_day_index
  // +7 is REQUIRED: JS % returns negative for negative inputs (unlike Python %)
  // e.g. startDay=1 (Monday), today=Sunday (0): (0 - 1 + 7) % 7 = 6 ✓
  //      without +7: (0 - 1) % 7 = -1 ✗
  const daysSinceStart = (dayIndex - startDay + 7) % 7;
  const result = new Date(d);
  result.setDate(d.getDate() - daysSinceStart);
  return result;
}

export function getWeekEnd(d: Date, startDay: WeekStartDay = 0): Date {
  const start = getWeekStart(d, startDay);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

export function getDaysLeft(today: Date, startDay: WeekStartDay = 0): number {
  // Accepts date as parameter — do NOT call new Date() internally (SSR returns UTC not local time)
  const weekEnd = getWeekEnd(today, startDay);
  const ms = weekEnd.getTime() - today.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function formatWeekLabel(start: Date): string {
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  return `WK OF ${months[start.getMonth()]} ${String(start.getDate()).padStart(2, "0")}`;
}

export function formatDayLabel(d: Date): string {
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}`;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
