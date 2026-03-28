import React from "react";

export default function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      style={{
        marginTop: 12,
        border: "1px solid #ffd3d3",
        background: "#fff5f5",
        color: "#8a1f1f",
        borderRadius: "var(--radius-sm)",
        padding: "10px 12px",
        fontWeight: 700,
      }}
    >
      {message}
    </div>
  );
}
