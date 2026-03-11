import { useState } from "react";
import { useNavigate, redirect, useSubmit } from "react-router";
import type { Route } from "./+types/settings";
import { C, font, raisedBorder, sunkenBorder } from "~/utils/win95";
import { W95Btn } from "~/components/W95Btn";
import { ApiClient } from "~/lib/api.server";
import type { User, Budget } from "~/types/api";
export { SessionExpiredBoundary as ErrorBoundary } from "~/components/SessionExpiredBoundary";

export function meta() {
  return [{ title: "L₇ — Settings" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const api = new ApiClient(request.headers.get("Cookie") ?? "");
  const [user, budget] = await Promise.all([
    api.get<User>("/auth/me"),
    api.get<Budget>("/budget"),
  ]);
  return { user, budget };
}

export async function action({ request }: Route.ActionArgs) {
  const api = new ApiClient(request.headers.get("Cookie") ?? "");
  const formData = await request.formData();
  const intent = formData.get("intent");
  if (typeof intent !== "string") return { ok: false };

  if (intent === "save") {
    const rawAmount = formData.get("weekly_amount");
    const rawStartDay = formData.get("week_start_day");
    if (typeof rawAmount !== "string" || typeof rawStartDay !== "string")
      return { ok: false };
    const weeklyAmount = parseFloat(rawAmount);
    const weekStartDay = parseInt(rawStartDay, 10);
    if (isNaN(weeklyAmount) || isNaN(weekStartDay)) return { ok: false };

    await Promise.all([
      api.put("/budget", { weekly_amount: weeklyAmount }),
      api.patch("/auth/me", { week_start_day: weekStartDay }),
    ]);

    // Navigate to home so the week boundary re-calculates with the new start day
    throw redirect("/");
  }

  return { ok: false };
}

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function SettingsPage({ loaderData }: Route.ComponentProps) {
  const { user, budget } = loaderData;
  const navigate = useNavigate();
  const submit = useSubmit();

  const [budgetValue, setBudgetValue] = useState(String(budget.weekly_amount));
  const [weekStart, setWeekStart] = useState(user.week_start_day);
  const [dropdownOpen, setDropdownOpen] = useState(false);

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
            padding: "3px 12px",
            cursor: "pointer",
            outline: "none",
          }}
        >
          ◄
        </button>
        <span
          style={{ color: "#ffffff", fontSize: 24, letterSpacing: "0.06em" }}
        >
          SETTINGS
        </span>
      </div>

      {/* Settings form */}
      <form
        method="post"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        <input type="hidden" name="intent" value="save" />

        {/* WEEKLY BUDGET */}
        <div>
          <label
            style={{
              display: "block",
              color: C.textMuted,
              fontSize: 16,
              letterSpacing: "0.1em",
              marginBottom: 6,
            }}
          >
            WEEKLY BUDGET
          </label>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span
              style={{
                color: C.textMuted,
                fontSize: 24,
                marginRight: 4,
                lineHeight: 1,
              }}
            >
              $
            </span>
            <input
              type="number"
              name="weekly_amount"
              value={budgetValue}
              onChange={(e) => setBudgetValue(e.target.value)}
              min="0.01"
              step="0.01"
              style={{
                ...sunkenBorder,
                backgroundColor: "#080808",
                color: C.text,
                fontFamily: font,
                fontSize: 26,
                padding: "8px 12px",
                outline: "none",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div
            style={{
              color: C.textDim,
              fontSize: 15,
              marginTop: 6,
              letterSpacing: "0.02em",
            }}
          >
            Changing this affects all historical calculations
          </div>
        </div>

        {/* WEEK STARTS ON */}
        <div style={{ position: "relative" }}>
          <label
            style={{
              display: "block",
              color: C.textMuted,
              fontSize: 16,
              letterSpacing: "0.1em",
              marginBottom: 6,
            }}
          >
            WEEK STARTS ON
          </label>
          <input type="hidden" name="week_start_day" value={weekStart} />
          <div
            onClick={() => setDropdownOpen((d) => !d)}
            style={{
              ...raisedBorder(),
              backgroundColor: C.surface,
              color: C.text,
              fontFamily: font,
              fontSize: 22,
              padding: "8px 12px",
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              userSelect: "none",
            }}
          >
            <span>{DAYS[weekStart].toUpperCase()}</span>
            <span style={{ color: C.textMuted, fontSize: 18 }}>▼</span>
          </div>

          {dropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                backgroundColor: C.surface,
                borderStyle: "solid",
                borderWidth: 2,
                borderTopColor: C.borderLight,
                borderLeftColor: C.borderLight,
                borderBottomColor: C.borderDark,
                borderRightColor: C.borderDark,
                zIndex: 200,
              }}
            >
              {DAYS.map((day, idx) => (
                <div
                  key={day}
                  onClick={() => {
                    setWeekStart(idx as 0 | 1 | 2 | 3 | 4 | 5 | 6);
                    setDropdownOpen(false);
                  }}
                  style={{
                    color: idx === weekStart ? "#aaccff" : C.text,
                    fontSize: 20,
                    padding: "8px 12px",
                    cursor: "pointer",
                    backgroundColor:
                      idx === weekStart ? "#1a1a2e" : "transparent",
                    borderBottom: `1px solid ${C.borderDark}`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.backgroundColor =
                      "#000088";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.backgroundColor =
                      idx === weekStart ? "#1a1a2e" : "transparent";
                  }}
                >
                  {day.toUpperCase()}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save Button */}
        <W95Btn type="submit" fullWidth style={{ fontSize: 20 }}>
          [ SAVE SETTINGS ]
        </W95Btn>

        {/* Divider */}
        <div style={{ borderTop: `1px solid ${C.borderDark}` }} />

        {/* LOG OUT */}
        <button
          type="button"
          onClick={() =>
            submit(new FormData(), { method: "post", action: "/logout" })
          }
          style={{
            ...raisedBorder(false),
            backgroundColor: "#1a0000",
            color: "#cc5555",
            fontFamily: font,
            fontSize: 20,
            padding: "8px 16px",
            cursor: "pointer",
            userSelect: "none",
            outline: "none",
            width: "100%",
            letterSpacing: "0.04em",
          }}
        >
          [ LOG OUT ]
        </button>

        {/* App version */}
        <div
          style={{
            color: C.textDim,
            fontSize: 15,
            textAlign: "center",
            letterSpacing: "0.06em",
            marginTop: "auto",
          }}
        >
          L₇ LEDGER SUB 7 • VER 1.0.0
        </div>
      </form>
    </div>
  );
}
