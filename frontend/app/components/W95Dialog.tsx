import { useEffect, useRef } from "react";
import { C, font, raisedBorder } from "~/utils/win95";
import { fmt } from "~/utils/fmt";
import { W95Btn } from "~/components/W95Btn";

export function DialogOverlay({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Focus trap and Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      role="alertdialog"
      aria-modal="true"
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 300,
        padding: 16,
      }}
    >
      {children}
    </div>
  );
}

export function DialogBox({
  title,
  children,
  buttons,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  buttons: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div
      style={{
        backgroundColor: C.surface,
        borderStyle: "solid",
        borderWidth: 2,
        borderTopColor: C.borderLight,
        borderLeftColor: C.borderLight,
        borderBottomColor: C.borderDark,
        borderRightColor: C.borderDark,
        width: "100%",
        maxWidth: 340,
        fontFamily: font,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          backgroundColor: C.titleBar,
          padding: "4px 8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ color: C.titleBarText, fontSize: 18, letterSpacing: "0.05em" }}>
          {title}
        </span>
        <span
          style={{ color: C.titleBarText, fontSize: 14, cursor: "pointer" }}
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </span>
      </div>
      {/* Body */}
      <div style={{ padding: "16px 14px 12px" }}>{children}</div>
      {/* Buttons */}
      <div
        style={{
          padding: "8px 14px 14px",
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          flexWrap: "wrap",
        }}
      >
        {buttons}
      </div>
    </div>
  );
}

interface PartialCentsDialogProps {
  amount: number;
  onCancel: () => void;
  onRoundDown: () => void;
  onRoundUp: () => void;
}

export function PartialCentsDialog({ amount, onCancel, onRoundDown, onRoundUp }: PartialCentsDialogProps) {
  const down = Math.floor(amount * 100) / 100;
  const up = Math.ceil(amount * 100) / 100;
  return (
    <DialogOverlay onClose={onCancel}>
      <DialogBox
        title="ATTENTION"
        onClose={onCancel}
        buttons={
          <>
            <W95Btn onClick={onCancel} style={{ fontSize: 16 }}>CANCEL</W95Btn>
            <W95Btn onClick={onRoundDown} style={{ fontSize: 16 }}>↓ ${fmt(down)}</W95Btn>
            <W95Btn onClick={onRoundUp} style={{ fontSize: 16 }}>↑ ${fmt(up)}</W95Btn>
          </>
        }
      >
        <div style={{ color: C.textMuted, fontSize: 18, marginBottom: 8 }}>
          Amount has more than 2 decimal places.
        </div>
        <div style={{ color: C.text, fontSize: 34, letterSpacing: "0.04em" }}>
          ${amount.toFixed(3)}
        </div>
      </DialogBox>
    </DialogOverlay>
  );
}

interface NegativeResultDialogProps {
  amount: number;
  onCancel: () => void;
  onMakePositive: () => void;
  onAddAsCredit: () => void;
}

export function NegativeResultDialog({ amount, onCancel, onMakePositive, onAddAsCredit }: NegativeResultDialogProps) {
  return (
    <DialogOverlay onClose={onCancel}>
      <DialogBox
        title="ATTENTION"
        onClose={onCancel}
        buttons={
          <>
            <W95Btn onClick={onCancel} style={{ fontSize: 16 }}>CANCEL</W95Btn>
            <W95Btn onClick={onMakePositive} style={{ fontSize: 16 }}>+${fmt(Math.abs(amount))}</W95Btn>
            <W95Btn onClick={onAddAsCredit} style={{ fontSize: 16, color: C.cyan }}>ADD AS CR</W95Btn>
          </>
        }
      >
        <div style={{ color: C.textMuted, fontSize: 18, marginBottom: 8 }}>
          Result is negative.
        </div>
        <div style={{ color: "#cc4444", fontSize: 34, letterSpacing: "0.04em" }}>
          -${fmt(Math.abs(amount))}
        </div>
      </DialogBox>
    </DialogOverlay>
  );
}
