import React from "react";

export default function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: "999px",
        border: "1px solid var(--border)",
        background: "#fafafa",
        fontWeight: 800,
        fontSize: 12,
      }}
    >
      {children}
    </span>
  );
}
