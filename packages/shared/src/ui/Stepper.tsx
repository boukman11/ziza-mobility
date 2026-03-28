import React from "react";
import Badge from "./Badge";

export default function Stepper({
  steps,
  current,
}: {
  steps: string[];
  current: number; // 0-based
}) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      {steps.map((s, idx) => (
        <div key={s} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Badge>{idx + 1}</Badge>
          <span style={{ fontWeight: idx === current ? 800 : 600, opacity: idx <= current ? 1 : 0.5 }}>{s}</span>
          {idx < steps.length - 1 && <span className="muted">→</span>}
        </div>
      ))}
    </div>
  );
}
