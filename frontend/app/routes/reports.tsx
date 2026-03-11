import { useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import type { Route } from "./+types/reports";
import { C, font, raisedBorder, sunkenBorder } from "~/utils/win95";
import { fmt } from "~/utils/fmt";
import { getWeekStart, getWeekEnd, toISODate } from "~/utils/weeks";
import { ReportEntryRow } from "~/components/EntryRow";
import { W95Btn } from "~/components/W95Btn";
import { ApiClient } from "~/lib/api.server";
import type { User, Budget, ReportSummary, WeekStartDay } from "~/types/api";

export function meta() {
  return [{ title: "L₇ — Reports" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const api = new ApiClient(request.headers.get("Cookie") ?? "");
  const params = new URL(request.url).searchParams;
  const hasExplicitRange = params.has("start") && params.has("end");

  if (hasExplicitRange) {
    const [meResult, summaryResult] = await Promise.all([
      api.get<User>("/auth/me"),
      api.get<ReportSummary>(`/reports/summary?${params.toString()}`),
    ]);

    return {
      user: meResult,
      summary: summaryResult,
      today: toISODate(new Date()),
    };
  }

  // Sequential: need me first to compute default range
  const today = new Date();
  const user = await api.get<User>("/auth/me");

  const weekStart = getWeekStart(today, user.week_start_day);
  const weekEnd = getWeekEnd(today, user.week_start_day);

  const defaultStart = params.get("start") ?? toISODate(weekStart);
  const defaultEnd = params.get("end") ?? toISODate(weekEnd);
  const groupBy = params.get("group_by") ?? undefined;

  let summaryPath = `/reports/summary?start=${defaultStart}&end=${defaultEnd}`;
  if (groupBy) summaryPath += `&group_by=${groupBy}`;

  const summary = await api.get<ReportSummary>(summaryPath);

  return { user, summary, today: toISODate(today) };
}

type Range =
  | "THIS WEEK"
  | "LAST WEEK"
  | "THIS MONTH"
  | "LAST MONTH"
  | "THIS YEAR";

function computeRange(
  range: Range,
  today: Date,
  startDay: WeekStartDay,
): { start: string; end: string; groupBy?: string } {
  const weekStart = getWeekStart(today, startDay);
  const weekEnd = getWeekEnd(today, startDay);

  if (range === "THIS WEEK")
    return { start: toISODate(weekStart), end: toISODate(weekEnd) };

  if (range === "LAST WEEK") {
    const lastWeekEnd = new Date(weekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
    const lastWeekStart = getWeekStart(lastWeekEnd, startDay);
    return { start: toISODate(lastWeekStart), end: toISODate(lastWeekEnd) };
  }

  if (range === "THIS MONTH") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { start: toISODate(start), end: toISODate(end), groupBy: "week" };
  }

  if (range === "LAST MONTH") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { start: toISODate(start), end: toISODate(end), groupBy: "week" };
  }

  if (range === "THIS YEAR") {
    const start = new Date(today.getFullYear(), 0, 1);
    const end = new Date(today.getFullYear(), 11, 31);
    return { start: toISODate(start), end: toISODate(end), groupBy: "week" };
  }

  return { start: toISODate(weekStart), end: toISODate(weekEnd) };
}

export default function ReportsPage({ loaderData }: Route.ComponentProps) {
  const { user, summary, today } = loaderData;
  const navigate = useNavigate();

  // useFetcher for range changes prevents out-of-order response race
  const fetcher = useFetcher<typeof loader>();
  const [range, setRange] = useState<Range>("THIS WEEK");
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);

  const activeSummary = fetcher.data?.summary ?? summary;
  const todayDate = new Date(today + "T12:00:00");

  function handleRangeChange(newRange: Range) {
    setRange(newRange);
    setShowMoreDropdown(false);
    const { start, end, groupBy } = computeRange(
      newRange,
      todayDate,
      user.week_start_day,
    );
    let path = `/reports?start=${start}&end=${end}`;
    if (groupBy) path += `&group_by=${groupBy}`;
    fetcher.load(path);
  }

  const ranges: Range[] = [
    "THIS WEEK",
    "LAST WEEK",
    "THIS MONTH",
    "LAST MONTH",
  ];

  const periodLabel = `${activeSummary.start} – ${activeSummary.end}`;
  const hasData = activeSummary.weeks || activeSummary.entries;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: C.bg,
        display: "flex",
        flexDirection: "column",
        fontFamily: font,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Title bar */}
      <div
        style={{
          backgroundColor: C.titleBar,
          padding: "6px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => navigate("/")}
          style={{
            ...raisedBorder(),
            backgroundColor: C.surface,
            color: C.text,
            fontFamily: font,
            fontSize: 18,
            padding: "3px 8px",
            cursor: "pointer",
            outline: "none",
          }}
        >
          ◄
        </button>
        <span
          style={{ color: "#ffffff", fontSize: 20, letterSpacing: "0.06em" }}
        >
          REPORTS
        </span>
      </div>

      {/* Range Selector */}
      <div
        style={{
          padding: "10px 10px 8px",
          borderBottom: `1px solid ${C.borderDark}`,
          flexShrink: 0,
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            paddingBottom: 2,
          }}
        >
          {ranges.map((r) => (
            <W95Btn
              key={r}
              active={range === r}
              onClick={() => handleRangeChange(r)}
              style={{
                fontSize: 15,
                padding: "5px 10px",
                whiteSpace: "nowrap",
              }}
            >
              {r}
            </W95Btn>
          ))}
          <W95Btn
            active={showMoreDropdown}
            onClick={() => setShowMoreDropdown((d) => !d)}
            style={{ fontSize: 15, padding: "5px 10px" }}
          >
            MORE...
          </W95Btn>
        </div>

        {showMoreDropdown && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: 10,
              backgroundColor: C.surface,
              borderStyle: "solid",
              borderWidth: 2,
              borderTopColor: C.borderLight,
              borderLeftColor: C.borderLight,
              borderBottomColor: C.borderDark,
              borderRightColor: C.borderDark,
              zIndex: 200,
              minWidth: 200,
            }}
          >
            <div
              onClick={() => handleRangeChange("THIS YEAR")}
              style={{
                color: C.text,
                fontSize: 18,
                padding: "8px 12px",
                cursor: "pointer",
                borderBottom: `1px solid ${C.borderDark}`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.backgroundColor =
                  "#000088";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.backgroundColor =
                  "transparent";
              }}
            >
              THIS YEAR
            </div>
            <div
              style={{
                color: C.textDim,
                fontSize: 18,
                padding: "8px 12px",
                cursor: "default",
              }}
            >
              CUSTOM RANGE (SOON)
            </div>
          </div>
        )}
      </div>

      {/* Summary Block */}
      <div
        style={{
          margin: "10px 10px 0",
          ...sunkenBorder,
          backgroundColor: C.surfaceAlt,
          padding: "10px 12px",
          flexShrink: 0,
        }}
      >
        {[
          { label: "PERIOD", val: periodLabel },
          { label: "SPENT", val: `$${fmt(activeSummary.total_spent)}` },
          {
            label: "CREDITS",
            val: `$${fmt(activeSummary.total_credits)}`,
            color: C.cyan,
          },
          { label: "NET", val: `$${fmt(activeSummary.net)}` },
        ].map((row) => (
          <div
            key={row.label}
            style={{ display: "flex", gap: 8, marginBottom: 4 }}
          >
            <span
              style={{
                color: C.textMuted,
                fontSize: 18,
                minWidth: 80,
                letterSpacing: "0.04em",
              }}
            >
              {row.label}:
            </span>
            <span style={{ color: row.color ?? C.text, fontSize: 18 }}>
              {row.val}
            </span>
          </div>
        ))}
      </div>

      {/* Entry List */}
      <div
        style={{ flex: 1, overflowY: "auto", padding: "6px 0", minHeight: 0 }}
      >
        {!hasData ? (
          <div
            style={{
              color: C.textMuted,
              fontSize: 18,
              padding: "20px 10px",
              textAlign: "center",
            }}
          >
            NO ENTRIES FOR THIS PERIOD
          </div>
        ) : activeSummary.weeks ? (
          activeSummary.weeks.map((week) => (
            <div key={week.week_start}>
              {/* Week separator */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "6px 10px",
                  color: C.textMuted,
                  fontSize: 16,
                  letterSpacing: "0.06em",
                  borderTop: `1px solid ${C.borderDark}`,
                  borderBottom: `1px solid ${C.borderDark}`,
                  backgroundColor: C.surfaceAlt,
                  gap: 8,
                }}
              >
                <span>── WK OF {week.week_start}</span>
                <span style={{ flex: 1 }} />
                <span>${fmt(week.net_spent)}</span>
                <span>──</span>
              </div>
              {week.entries.map((entry) => (
                <ReportEntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          ))
        ) : (
          activeSummary.entries?.map((entry) => (
            <ReportEntryRow key={entry.id} entry={entry} />
          ))
        )}
      </div>
    </div>
  );
}
