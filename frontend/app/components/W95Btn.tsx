import { useState } from "react";
import { C, font, raisedBorder } from "~/utils/win95";

interface W95BtnProps {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  destructive?: boolean;
  type?: "button" | "submit" | "reset";
  className?: string;
  style?: React.CSSProperties;
}

export function W95Btn({
  children,
  onClick,
  active,
  disabled,
  fullWidth,
  destructive,
  type = "button",
  className,
  style,
}: W95BtnProps) {
  const [pressed, setPressed] = useState(false);
  const isActive = active || pressed;

  return (
    <button
      type={type}
      className={className}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => !disabled && setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onClick={disabled ? undefined : onClick}
      style={{
        ...raisedBorder(isActive),
        backgroundColor: destructive
          ? isActive ? "#2a0000" : "#1a0000"
          : disabled
          ? "#161616"
          : C.surface,
        color: destructive ? "#cc5555" : disabled ? C.textDim : C.text,
        fontFamily: font,
        fontSize: 18,
        padding: isActive ? "9px 10px 7px" : "8px 10px",
        cursor: disabled ? "default" : "pointer",
        userSelect: "none",
        outline: "none",
        width: fullWidth ? "100%" : undefined,
        letterSpacing: "0.04em",
        minHeight: 44, // minimum touch target
        ...style,
      }}
    >
      {children}
    </button>
  );
}
