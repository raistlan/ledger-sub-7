import { C, font, raisedBorder } from "~/utils/win95";
import { fmt } from "~/utils/fmt";
import type { Entry } from "~/types/api";
import { W95Btn } from "~/components/W95Btn";

interface EntryRowProps {
  entry: Entry & { dateLabel: string };
  selected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  selectable?: boolean;
}

export function EntryRow({
  entry,
  selected,
  onSelect,
  onEdit,
  onDelete,
  selectable = false,
}: EntryRowProps) {
  const isCredit = entry.type === "credit";

  return (
    <div
      onClick={selectable ? onSelect : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        height: 58,
        boxSizing: "border-box",
        backgroundColor: selected ? C.surfaceAlt : "transparent",
        borderTop: selected
          ? `1px solid ${C.borderMid}`
          : "1px solid transparent",
        borderBottom: selected
          ? `1px solid ${C.borderMid}`
          : "1px solid transparent",
        cursor: selectable ? "pointer" : "default",
        gap: 8,
        fontFamily: font,
      }}
    >
      {/* Amount */}
      <div
        style={{
          color: isCredit ? C.cyan : C.text,
          fontSize: 26,
          lineHeight: 1,
          minWidth: 110,
          flexShrink: 0,
        }}
      >
        {isCredit && (
          <span
            style={{
              ...raisedBorder(),
              color: C.cyan,
              fontSize: 13,
              padding: "1px 4px",
              marginRight: 8,
              verticalAlign: "middle",
            }}
          >
            CR
          </span>
        )}
        {isCredit ? "+" : "−"}${fmt(entry.amount)}
      </div>

      {/* Memo */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {entry.memo && (
          <span style={{ color: C.textMuted, fontSize: 18 }}>{entry.memo}</span>
        )}
      </div>

      {/* Date (hidden when selected) */}
      {!selected && (
        <div style={{ color: C.textDim, fontSize: 16, flexShrink: 0 }}>
          {entry.dateLabel}
        </div>
      )}

      {/* Selected: action buttons */}
      {selected && (
        <div
          style={{ display: "flex", gap: 6, flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <W95Btn style={{ fontSize: 15, padding: "4px 8px" }} onClick={onEdit}>
            EDIT
          </W95Btn>
          <W95Btn
            style={{ fontSize: 15, padding: "4px 8px", color: "#cc6666" }}
            onClick={onDelete}
          >
            DEL
          </W95Btn>
        </div>
      )}
    </div>
  );
}

/** Read-only entry row for reports (no selection/edit/delete) */
export function ReportEntryRow({
  entry,
}: {
  entry: { amount: number; type: string; memo: string | null; date: string };
}) {
  const isCredit = entry.type === "credit";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "6px 10px",
        borderBottom: `1px solid ${C.borderDark}`,
        gap: 8,
        fontFamily: font,
      }}
    >
      <div
        style={{
          color: isCredit ? C.cyan : C.text,
          fontSize: 24,
          minWidth: 105,
          flexShrink: 0,
        }}
      >
        {isCredit && (
          <span
            style={{
              ...raisedBorder(),
              color: C.cyan,
              fontSize: 13,
              padding: "1px 4px",
              marginRight: 8,
              borderWidth: 1,
              borderStyle: "solid",
              borderTopColor: C.borderLight,
              borderLeftColor: C.borderLight,
              borderBottomColor: C.borderDark,
              borderRightColor: C.borderDark,
            }}
          >
            CR
          </span>
        )}
        {isCredit ? "+" : "−"}${fmt(entry.amount)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color: C.textMuted, fontSize: 17 }}>{entry.memo}</span>
      </div>
      <div style={{ color: C.textDim, fontSize: 15, flexShrink: 0 }}>
        {entry.date}
      </div>
    </div>
  );
}
