import React from "react";

export default function StatusTimeline({
  order,
  current,
}: {
  order: string[];
  current?: string;
}) {
  const idx = current ? Math.max(0, order.indexOf(current)) : 0;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {order.map((s, i) => (
        <span key={s} className="badge" style={{ opacity: i <= idx ? 1 : 0.35 }}>
          {s}
        </span>
      ))}
    </div>
  );
}
