import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigation, useNavigate, useSubmit } from "react-router";
import type { Route } from "./+types/home";
import { C, font, raisedBorder, sunkenBorder } from "~/utils/win95";
import { fmt } from "~/utils/fmt";
import { evalExpression } from "~/utils/calculator";
import {
  getWeekStart,
  getWeekEnd,
  getDaysLeft,
  formatDayLabel,
  toISODate,
} from "~/utils/weeks";
import { PipBar } from "~/components/PipBar";
import { EntryRow } from "~/components/EntryRow";
import {
  PartialCentsDialog,
  NegativeResultDialog,
} from "~/components/W95Dialog";
import { W95Btn } from "~/components/W95Btn";
import { ApiClient } from "~/lib/api.server";
import type { Entry, Budget, User } from "~/types/api";
export { SessionExpiredBoundary as ErrorBoundary } from "~/components/SessionExpiredBoundary";

export function meta() {
  return [{ title: "L₇ — Weekly Budget" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const api = new ApiClient(request.headers.get("Cookie") ?? "");
  const today = new Date();
  const user = await api.get<User>("/auth/me");
  const weekStart = getWeekStart(today, user.week_start_day);
  const weekEnd = getWeekEnd(today, user.week_start_day);

  const [entries, budget] = await Promise.all([
    api.get<Entry[]>(
      `/entries?start=${toISODate(weekStart)}&end=${toISODate(weekEnd)}&limit=200`,
    ),
    api.get<Budget>("/budget"),
  ]);

  return {
    entries,
    budget,
    user,
    today: toISODate(today),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const api = new ApiClient(request.headers.get("Cookie") ?? "");
  const formData = await request.formData();
  const intent = formData.get("intent");
  if (typeof intent !== "string") return { ok: false };

  if (intent === "create") {
    const rawAmount = formData.get("amount");
    if (typeof rawAmount !== "string") return { ok: false };
    const amount = parseFloat(rawAmount);
    if (isNaN(amount)) return { ok: false };
    await api.post("/entries", {
      amount,
      type: formData.get("type"),
      memo: formData.get("memo") || null,
      date: formData.get("date"),
    });
    return { ok: true };
  }

  if (intent === "delete") {
    const entryId = formData.get("entryId");
    if (typeof entryId !== "string") return { ok: false };
    await api.delete(`/entries/${entryId}`);
    return { ok: true };
  }

  if (intent === "update") {
    const entryId = formData.get("entryId");
    if (typeof entryId !== "string") return { ok: false };
    const rawAmount = formData.get("amount");
    if (typeof rawAmount !== "string") return { ok: false };
    const amount = parseFloat(rawAmount);
    if (isNaN(amount)) return { ok: false };
    await api.put(`/entries/${entryId}`, {
      amount,
      type: formData.get("type"),
      memo: formData.get("memo") || null,
      date: formData.get("date"),
    });
    return { ok: true };
  }

  return { ok: false };
}

type DialogPhase = "none" | "negative" | "partial_cents";

interface PendingEntry {
  amount: number;
  type: "expense" | "credit";
  memo: string;
  date: string;
}

export default function HomePage({ loaderData }: Route.ComponentProps) {
  const { entries, budget, user, today } = loaderData;
  const navigation = useNavigation();
  const navigate = useNavigate();
  const submit = useSubmit();

  const isSubmitting = navigation.state !== "idle";

  // Calculator state
  const [display, setDisplay] = useState("");
  const [entryType, setEntryType] = useState<"expense" | "credit">("expense");
  const [showMemo, setShowMemo] = useState(false);
  const [memoText, setMemoText] = useState("");
  const [pendingExpr, setPendingExpr] = useState("");

  // Dialog state machine — never two booleans
  const [dialogPhase, setDialogPhase] = useState<DialogPhase>("none");
  const [pendingEntry, setPendingEntry] = useState<PendingEntry | null>(null);

  // Selection state
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Kebab menu
  const [showKebab, setShowKebab] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const memoRef = useRef<HTMLInputElement>(null);

  // Clear selectedId when revalidation removes the entry
  useEffect(() => {
    if (selectedId && !entries.find((e) => e.id === selectedId)) {
      setSelectedId(null);
    }
  }, [entries, selectedId]);

  // Auto-scroll entry list to bottom
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [entries]);

  // Auto-focus memo input
  useEffect(() => {
    if (showMemo && memoRef.current) {
      memoRef.current.focus();
    }
  }, [showMemo]);

  // Compute display values
  const todayDate = new Date(today + "T12:00:00");
  const weekStart = getWeekStart(todayDate, user.week_start_day);
  const daysLeft = getDaysLeft(todayDate, user.week_start_day);

  const spent = entries
    .filter((e) => e.type === "expense")
    .reduce((s, e) => s + e.amount, 0);
  const credits = entries
    .filter((e) => e.type === "credit")
    .reduce((s, e) => s + e.amount, 0);
  const net = spent - credits;
  const pct =
    budget.weekly_amount > 0
      ? Math.round((net / budget.weekly_amount) * 100)
      : 0;
  const overBudget = net > budget.weekly_amount;

  // Build date labels for entry list (memoized to avoid re-computing on every keypad press)
  const entriesWithLabels = useMemo(
    () =>
      entries.map((e) => ({
        ...e,
        dateLabel: formatDayLabel(new Date(e.date + "T12:00:00")),
      })),
    [entries],
  );

  function handleKey(key: string) {
    if (showMemo) return;
    if (isSubmitting) return;

    if (key === "BS") {
      setDisplay((d) => d.slice(0, -1));
      return;
    }

    if (key === "MEMO") {
      if (!display.trim()) return;
      const result = evalExpression(display);
      if (result !== null && result !== 0) {
        setPendingExpr(display);
        setShowMemo(true);
      }
      return;
    }

    if (key === "=") {
      if (!display.trim()) return;
      const result = evalExpression(display);
      if (result === null) {
        setDisplay("ERR");
        setTimeout(() => setDisplay(""), 1000);
        return;
      }

      const snapshot: PendingEntry = {
        amount: result,
        type: entryType,
        memo: "",
        date: today,
      };

      if (result < 0) {
        setPendingEntry(snapshot);
        setDialogPhase("negative");
        return;
      }

      const rounded = Math.round(result * 100) / 100;
      if (Math.abs(result - rounded) > 0.0001) {
        setPendingEntry({ ...snapshot, amount: result });
        setDialogPhase("partial_cents");
        return;
      }

      commitEntry({ ...snapshot, amount: rounded });
      return;
    }

    // Prevent double operators
    const ops = ["+", "-", "x", "/"];
    const last = display[display.length - 1];
    if (ops.includes(key) && ops.includes(last)) {
      setDisplay((d) => d.slice(0, -1) + key);
      return;
    }
    if (ops.includes(key) && !display) return;
    setDisplay((d) => d + key);
  }

  function commitEntry(entry: PendingEntry) {
    if (isSubmitting) return;
    const form = new FormData();
    form.set("intent", "create");
    form.set("amount", String(Math.abs(entry.amount)));
    form.set("type", entry.type);
    form.set("memo", entry.memo);
    form.set("date", entry.date);
    submit(form, { method: "post" });
    setDisplay("");
    setMemoText("");
    setPendingExpr("");
    setShowMemo(false);
    setDialogPhase("none");
    setPendingEntry(null);
  }

  function handleDialogCancel() {
    setDialogPhase("none");
    setPendingEntry(null);
  }

  function handleRoundDown() {
    if (!pendingEntry) return;
    const val = Math.floor(pendingEntry.amount * 100) / 100;
    commitEntry({ ...pendingEntry, amount: val });
  }

  function handleRoundUp() {
    if (!pendingEntry) return;
    const val = Math.ceil(pendingEntry.amount * 100) / 100;
    commitEntry({ ...pendingEntry, amount: val });
  }

  function handleMakePositive() {
    if (!pendingEntry) return;
    commitEntry({ ...pendingEntry, amount: Math.abs(pendingEntry.amount) });
  }

  function handleAddAsCredit() {
    if (!pendingEntry) return;
    commitEntry({
      ...pendingEntry,
      amount: Math.abs(pendingEntry.amount),
      type: "credit",
    });
  }

  function handleLogout() {
    if (isSubmitting) return;
    submit(new FormData(), { method: "post", action: "/logout" });
  }

  const KEYS = [
    ["7", "8", "9", "/"],
    ["4", "5", "6", "x"],
    ["1", "2", "3", "-"],
    ["0", ".", "BS", "+"],
    ["MEMO", "="],
  ];

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
      onClick={() => showKebab && setShowKebab(false)}
    >
      {/* ── HEADER ── */}
      <div
        style={{
          backgroundColor: C.surface,
          borderBottom: `2px solid ${C.borderDark}`,
          padding: "10px 12px 8px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div style={{ color: C.text, fontSize: 30, lineHeight: 1.1 }}>
              ${fmt(net)}
              <span style={{ color: C.textMuted, fontSize: 22 }}>
                {" "}
                / ${fmt(budget.weekly_amount)}
              </span>
            </div>
            <div style={{ color: C.textMuted, fontSize: 17, marginTop: 2 }}>
              <span style={{ color: overBudget ? "#cc4444" : C.text }}>
                {overBudget ? "OVER" : `${pct}%`}
              </span>
              {"  •  "}
              <span>{daysLeft} DAYS LEFT</span>
            </div>
          </div>
          {/* Kebab menu button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowKebab((k) => !k);
            }}
            style={{
              background: "none",
              border: "none",
              color: C.textMuted,
              fontSize: 26,
              cursor: "pointer",
              padding: "2px 6px",
              fontFamily: font,
              lineHeight: 1,
              marginTop: 2,
            }}
          >
            ⋮
          </button>
        </div>
        <PipBar percentage={pct} overBudget={overBudget} />
      </div>

      {/* ── ENTRY LIST ── */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "4px 0",
          minHeight: 0,
        }}
      >
        {entriesWithLabels.map((entry, idx) => {
          const prevDate = idx > 0 ? entriesWithLabels[idx - 1].date : null;
          const showSep = prevDate && prevDate !== entry.date;

          return (
            <Fragment key={entry.id}>
              {showSep && (
                <div
                  style={{
                    borderTop: `1px solid ${C.borderDark}`,
                    margin: "2px 0",
                  }}
                />
              )}
              <EntryRow
                entry={entry}
                selected={selectedId === entry.id}
                onSelect={() =>
                  setSelectedId((id) => (id === entry.id ? null : entry.id))
                }
                onDelete={() => {
                  const form = new FormData();
                  form.set("intent", "delete");
                  form.set("entryId", entry.id);
                  submit(form, { method: "post" });
                }}
                selectable
              />
            </Fragment>
          );
        })}

        {entries.length === 0 && (
          <div
            style={{
              color: C.textDim,
              fontSize: 18,
              padding: "20px 12px",
              textAlign: "center",
            }}
          >
            NO ENTRIES THIS WEEK
          </div>
        )}
      </div>

      {/* ── CALCULATOR ── */}
      <div
        style={{
          backgroundColor: C.surface,
          borderTop: `2px solid ${C.borderDark}`,
          padding: "8px 8px 10px",
          flexShrink: 0,
        }}
      >
        {!showMemo ? (
          <>
            {/* Type Toggle */}
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <W95Btn
                active={entryType === "expense"}
                onClick={() => setEntryType("expense")}
                style={{ fontSize: 15, padding: "4px 8px", flex: 1 }}
              >
                {entryType === "expense" ? "▼ EXPENSE" : "  EXPENSE"}
              </W95Btn>
              <W95Btn
                active={entryType === "credit"}
                onClick={() => setEntryType("credit")}
                style={{
                  fontSize: 15,
                  padding: "4px 8px",
                  flex: 1,
                  color: entryType === "credit" ? C.cyan : C.textMuted,
                }}
              >
                {entryType === "credit" ? "▲ CREDIT" : "  CREDIT"}
              </W95Btn>
            </div>

            {/* Display */}
            <div
              style={{
                ...sunkenBorder,
                backgroundColor: "#080808",
                color: C.text,
                fontFamily: font,
                fontSize: 28,
                padding: "8px 12px",
                marginBottom: 6,
                textAlign: "right",
                letterSpacing: "0.04em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minHeight: 48,
              }}
              // inputMode="none" prevents soft keyboard on mobile
              inputMode="none"
            >
              {display || "0"}
              <span style={{ opacity: 0.5 }}>_</span>
            </div>

            {/* Keypad */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: 4 }}
              inputMode="none"
            >
              {KEYS.map((row, ri) => (
                <div key={ri} style={{ display: "flex", gap: 4 }}>
                  {row.map((key) => {
                    const isDouble = key === "MEMO" || key === "=";
                    const isEq = key === "=";
                    return (
                      <button
                        key={key}
                        onMouseDown={(e) => e.preventDefault()} // prevent focus steal
                        onTouchStart={(e) => {
                          e.preventDefault();
                          handleKey(key);
                        }}
                        onClick={() => handleKey(key)}
                        style={{
                          ...raisedBorder(false),
                          flex: isDouble ? 2 : 1,
                          height: 52,
                          backgroundColor: isEq ? "#000066" : C.surface,
                          color: isEq ? "#88aaff" : C.text,
                          fontFamily: font,
                          fontSize: 22,
                          cursor: "pointer",
                          userSelect: "none",
                          outline: "none",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {key === "BS" ? "⌫" : key}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Memo Mode */
          <div style={{ padding: "4px 0" }}>
            <div
              style={{
                color: C.textMuted,
                fontSize: 16,
                letterSpacing: "0.08em",
                marginBottom: 4,
              }}
            >
              MEMO:
            </div>
            <div style={{ color: C.text, fontSize: 24, marginBottom: 10 }}>
              {pendingExpr || "?"}{" "}
              <span style={{ color: C.textMuted, fontSize: 18 }}>
                ({entryType.toUpperCase()})
              </span>
            </div>
            <input
              ref={memoRef}
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const result = evalExpression(pendingExpr);
                  if (result !== null && result > 0) {
                    commitEntry({
                      amount: result,
                      type: entryType,
                      memo: memoText,
                      date: today,
                    });
                  }
                }
              }}
              placeholder="enter memo..."
              style={{
                ...sunkenBorder,
                backgroundColor: "#080808",
                color: C.text,
                fontFamily: font,
                fontSize: 24,
                padding: "8px 12px",
                width: "100%",
                outline: "none",
                boxSizing: "border-box",
                marginBottom: 8,
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <W95Btn
                onClick={() => {
                  setShowMemo(false);
                  setPendingExpr("");
                  setMemoText("");
                }}
                style={{ flex: 1, fontSize: 17 }}
              >
                CANCEL
              </W95Btn>
              <W95Btn
                onClick={() => {
                  const result = evalExpression(pendingExpr);
                  if (result !== null && result > 0) {
                    commitEntry({
                      amount: result,
                      type: entryType,
                      memo: memoText,
                      date: today,
                    });
                  }
                }}
                style={{ flex: 2, fontSize: 17 }}
              >
                SAVE MEMO
              </W95Btn>
            </div>
          </div>
        )}
      </div>

      {/* ── KEBAB MENU ── */}
      {showKebab && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: 48,
            right: 10,
            width: 170,
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
          {[
            { label: "Reports", path: "/reports" },
            { label: "Settings", path: "/settings" },
          ].map((item) => (
            <div
              key={item.label}
              onClick={() => {
                setShowKebab(false);
                navigate(item.path);
              }}
              style={{
                color: C.text,
                fontSize: 20,
                padding: "8px 14px",
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
              {item.label}
            </div>
          ))}
          <div
            style={{ borderTop: `1px solid ${C.borderMid}`, margin: "2px 0" }}
          />
          <div
            onClick={handleLogout}
            style={{
              color: "#cc6666",
              fontSize: 20,
              padding: "8px 14px",
              cursor: "pointer",
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
            Log Out
          </div>
        </div>
      )}

      {/* ── DIALOGS ── */}
      {dialogPhase === "partial_cents" && pendingEntry && (
        <PartialCentsDialog
          amount={pendingEntry.amount}
          onCancel={handleDialogCancel}
          onRoundDown={handleRoundDown}
          onRoundUp={handleRoundUp}
        />
      )}
      {dialogPhase === "negative" && pendingEntry && (
        <NegativeResultDialog
          amount={pendingEntry.amount}
          onCancel={handleDialogCancel}
          onMakePositive={handleMakePositive}
          onAddAsCredit={handleAddAsCredit}
        />
      )}
    </div>
  );
}
