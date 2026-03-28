import React from "react";

export default function Loader({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      style={{
        marginTop: 10,
        border: "1px solid var(--border)",
        background: "#fafafa",
        borderRadius: "var(--radius-sm)",
        padding: "10px 12px",
        fontWeight: 700,
      }}
    >
      {label}
    </div>
  );
}
