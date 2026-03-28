import React, { useMemo } from "react";
import Card from "./Card";
import Button from "./Button";

export type LatLng = { lat: number; lng: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function osmLink(p: LatLng, label: string) {
  const lat = p.lat.toFixed(6);
  const lng = p.lng.toFixed(6);
  // openstreetmap uses mlat/mlon to place marker
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}

function osmEmbedUrl(center: LatLng, bbox?: [number, number, number, number]) {
  const lat = center.lat.toFixed(6);
  const lng = center.lng.toFixed(6);
  const qs: string[] = [];
  if (bbox) {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    qs.push(`bbox=${minLng.toFixed(6)}%2C${minLat.toFixed(6)}%2C${maxLng.toFixed(6)}%2C${maxLat.toFixed(6)}`);
  }
  qs.push("layer=mapnik");
  // some deployments support marker param; if ignored, map still shows centered area
  qs.push(`marker=${lat}%2C${lng}`);
  return `https://www.openstreetmap.org/export/embed.html?${qs.join("&")}`;
}

export default function MapPreview({
  pickup,
  dropoff,
  title = "Map preview (V0)",
}: {
  pickup?: LatLng;
  dropoff?: LatLng;
  title?: string;
}) {
  const center = useMemo(() => {
    if (pickup && dropoff) return { lat: (pickup.lat + dropoff.lat) / 2, lng: (pickup.lng + dropoff.lng) / 2 };
    return pickup || dropoff || { lat: 40.7357, lng: -74.1724 };
  }, [pickup, dropoff]);

  const bbox = useMemo(() => {
    if (!pickup || !dropoff) return undefined;
    const minLat = Math.min(pickup.lat, dropoff.lat);
    const maxLat = Math.max(pickup.lat, dropoff.lat);
    const minLng = Math.min(pickup.lng, dropoff.lng);
    const maxLng = Math.max(pickup.lng, dropoff.lng);
    // pad a bit to make both points visible
    const padLat = clamp((maxLat - minLat) * 0.3, 0.01, 0.2);
    const padLng = clamp((maxLng - minLng) * 0.3, 0.01, 0.2);
    return [minLng - padLng, minLat - padLat, maxLng + padLng, maxLat + padLat] as [number, number, number, number];
  }, [pickup, dropoff]);

  return (
    <Card>
      <div style={{ fontWeight: 900 }}>{title}</div>
      <small className="muted">No API key, no extra npm deps. Links open OpenStreetMap.</small>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
        {pickup && (
          <a href={osmLink(pickup, "Pickup")} target="_blank" rel="noreferrer">
            <Button>Open pickup</Button>
          </a>
        )}
        {dropoff && (
          <a href={osmLink(dropoff, "Dropoff")} target="_blank" rel="noreferrer">
            <Button>Open dropoff</Button>
          </a>
        )}
        <a href={osmLink(center, "Center")} target="_blank" rel="noreferrer">
          <Button>Open center</Button>
        </a>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        <iframe
          title="osm-map"
          src={osmEmbedUrl(center, bbox)}
          style={{ width: "100%", height: 240, border: 0 }}
          loading="lazy"
        />
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
