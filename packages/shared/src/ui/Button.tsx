import React from "react";

type Variant = "primary" | "ghost";

export default function Button({
  children,
  onClick,
  disabled,
  variant = "ghost",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  variant?: Variant;
  type?: "button" | "submit";
}) {
  const base: React.CSSProperties = {
    borderRadius: "var(--radius-xs)",
    padding: "10px 12px",
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--fg)",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };

  const primary: React.CSSProperties = {
    background: "var(--primary)",
    color: "var(--primary-fg)",
    border: "1px solid var(--primary)",
  };

  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      style={{ ...base, ...(variant === "primary" ? primary : {}) }}
    >
      {children}
    </button>
  );
}
