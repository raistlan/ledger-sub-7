import { memo } from "react";
import { C, getNormalPipColor, getOverBudgetPipColor } from "~/utils/win95";

interface PipBarProps {
  percentage: number; // 0–100+ (>100 triggers over-budget mode)
  overBudget?: boolean;
}

export const PipBar = memo(function PipBar({ percentage, overBudget }: PipBarProps) {
  const isOverBudget = overBudget || percentage > 100;
  const filledCount = isOverBudget ? 20 : Math.min(20, Math.floor(percentage / 5));

  return (
    <div
      style={{
        display: "flex",
        gap: 3,
        width: "100%",
        padding: "6px 0 2px",
      }}
    >
      {Array.from({ length: 20 }, (_, i) => {
        const isFilled = i < filledCount;
        let bgColor: string;
        if (!isFilled) {
          bgColor = "#1a1a1a";
        } else if (isOverBudget) {
          bgColor = getOverBudgetPipColor(i);
        } else {
          bgColor = getNormalPipColor(i);
        }

        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: 12,
              backgroundColor: bgColor,
              borderStyle: "solid",
              borderWidth: 1,
              borderTopColor: isFilled ? "rgba(255,255,255,0.15)" : C.borderDark,
              borderLeftColor: isFilled ? "rgba(255,255,255,0.15)" : C.borderDark,
              borderBottomColor: isFilled ? "rgba(0,0,0,0.4)" : "#111",
              borderRightColor: isFilled ? "rgba(0,0,0,0.4)" : "#111",
            }}
          />
        );
      })}
    </div>
  );
});
