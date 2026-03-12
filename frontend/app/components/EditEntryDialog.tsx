import { useState } from "react";
import { DialogOverlay, DialogBox } from "~/components/W95Dialog";
import { W95Btn } from "~/components/W95Btn";
import { C, font, sunkenBorder } from "~/utils/win95";
import type { Entry } from "~/types/api";

interface EditEntryDialogProps {
  entry: Entry;
  onCancel: () => void;
  onSave: (updates: { amount: number; type: "expense" | "credit"; memo: string }) => void;
}

export function EditEntryDialog({ entry, onCancel, onSave }: EditEntryDialogProps) {
  const [amountStr, setAmountStr] = useState(String(entry.amount));
  const [type, setType] = useState<"expense" | "credit">(entry.type);
  const [memo, setMemo] = useState(entry.memo ?? "");

  function handleSave() {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;
    onSave({ amount, type, memo });
  }

  return (
    <DialogOverlay onClose={onCancel}>
      <DialogBox
        title="EDIT ENTRY"
        onClose={onCancel}
        buttons={
          <>
            <W95Btn onClick={onCancel} style={{ fontSize: 16 }}>CANCEL</W95Btn>
            <W95Btn onClick={handleSave} style={{ fontSize: 16 }}>SAVE</W95Btn>
          </>
        }
      >
        {/* Type toggle */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <W95Btn
            active={type === "expense"}
            onClick={() => setType("expense")}
            style={{ fontSize: 15, padding: "4px 8px", flex: 1 }}
          >
            {type === "expense" ? "▼ EXPENSE" : "  EXPENSE"}
          </W95Btn>
          <W95Btn
            active={type === "credit"}
            onClick={() => setType("credit")}
            style={{
              fontSize: 15,
              padding: "4px 8px",
              flex: 1,
              color: type === "credit" ? C.cyan : C.textMuted,
            }}
          >
            {type === "credit" ? "▲ CREDIT" : "  CREDIT"}
          </W95Btn>
        </div>

        {/* Amount */}
        <div style={{ color: C.textMuted, fontSize: 14, marginBottom: 4, fontFamily: font }}>
          AMOUNT
        </div>
        <input
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          style={{
            ...sunkenBorder,
            backgroundColor: "#080808",
            color: C.text,
            fontFamily: font,
            fontSize: 22,
            padding: "6px 10px",
            width: "100%",
            outline: "none",
            boxSizing: "border-box",
            marginBottom: 10,
          }}
        />

        {/* Memo */}
        <div style={{ color: C.textMuted, fontSize: 14, marginBottom: 4, fontFamily: font }}>
          MEMO
        </div>
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="optional..."
          style={{
            ...sunkenBorder,
            backgroundColor: "#080808",
            color: C.text,
            fontFamily: font,
            fontSize: 22,
            padding: "6px 10px",
            width: "100%",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </DialogBox>
    </DialogOverlay>
  );
}
