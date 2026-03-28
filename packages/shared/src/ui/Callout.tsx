import React from "react";

export default function Callout({
  title,
  body,
}: {
  title: string;
  body?: string;
}) {
  return (
    <div className="card" style={{ border: "1px solid #eee", background: "#fcfcfc" }}>
      <div style={{ fontWeight: 800 }}>{title}</div>
      {body && <p className="muted" style={{ marginTop: 6 }}>{body}</p>}
    </div>
  );
}
