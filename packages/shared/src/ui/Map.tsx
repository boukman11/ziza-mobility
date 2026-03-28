import React from "react";
import Card from "./Card";

export type LatLng = { lat: number; lng: number };

function Dot({ label, x, y }: { label: string; x: number; y: number }) {
  return (
    <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)" }}>
      <div style={{ width: 10, height: 10, borderRadius: 999, background: "#111" }} />
      <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>{label}</div>
    </div>
  );
}

export default function MapPlaceholder({ pickup, dropoff }: { pickup?: LatLng; dropoff?: LatLng }) {
  // Fake projection: just spreads points for readability
  const px = 25, py = 50;
  const dx = 75, dy = 50;

  return (
    <Card>
      <div style={{ fontWeight: 800 }}>Map (placeholder)</div>
      <small className="muted">Sprint 23: vraie carte. Ici: visualisation simple + coordonnées.</small>

      <div style={{ position: "relative", height: 180, border: "1px dashed #ddd", borderRadius: 12, marginTop: 12, background: "#fcfcfc" }}>
        <Dot label="Pickup" x={px} y={py} />
        <Dot label="Dropoff" x={dx} y={dy} />
        <div style={{ position: "absolute", left: "26%", top: "50%", width: "48%", height: 2, background: "#ddd" }} />
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Pickup</div>
          <small className="muted">{pickup ? `${pickup.lat.toFixed(5)}, ${pickup.lng.toFixed(5)}` : "-"}</small>
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>Dropoff</div>
          <small className="muted">{dropoff ? `${dropoff.lat.toFixed(5)}, ${dropoff.lng.toFixed(5)}` : "-"}</small>
        </div>
      </div>
    </Card>
  );
}
