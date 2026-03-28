import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../api";
import { keycloak } from "../../keycloak";
import { useToast } from "@shared/ui/Toast";
import ErrorBanner from "@shared/ui/ErrorBanner";
import Card from "@shared/ui/Card";
import Button from "@shared/ui/Button";
import MapPreview from "@shared/ui/MapPreview";
import Badge from "@shared/ui/Badge";
import Callout from "@shared/ui/Callout";
import { Link, useNavigate } from "react-router-dom";

type AvailableTrip = {
  tripId: string;
  distance_km: number;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  pricing: { currency: string; estimated_price: number };
};

export default function Availability() {
  const toast = useToast();
  const nav = useNavigate();
  const [radius, setRadius] = useState("10");
  const [items, setItems] = useState<AvailableTrip[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selected, setSelected] = useState<AvailableTrip | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setErr(""); setMsg(""); setBusy(true);
    if (!keycloak.authenticated) { setErr("Login required."); setBusy(false); return; }
    try {
      const res = await apiFetch<any>(`/v1/driver/trips/available?radius_km=${encodeURIComponent(radius)}&limit=50&offset=0`, { method: "GET" });
      const list = (res.items || []) as AvailableTrip[];
      setItems(list);
      setSelected((prev) => prev ? (list.find(x => x.tripId === prev.tripId) || list[0] || null) : (list[0] || null));
    } catch (e: any) { setErr(e.message); toast.push(e.message, "error"); }
    finally { setBusy(false); }
  }

  async function accept(tripId: string, go: boolean) {
    setErr(""); setMsg(""); setBusy(true);
    try {
      await apiFetch<any>(`/v1/driver/trips/${tripId}/accept`, { method: "POST" });
      toast.push("Trip accepted", "success");
      setMsg(`Accepted trip ${tripId}`);
      if (go) {
        nav("/active");
        return;
      }
      await load();
    } catch (e: any) { setErr(e.message); toast.push(e.message, "error"); }
    finally { setBusy(false); }
  }

  useEffect(() => { load(); }, []);

  const preview = useMemo(() => selected, [selected]);


  useEffect(() => {
    if (!autoRefresh) return;
    const t = window.setInterval(async () => {
      try { await load(); } catch {}
    }, 4000);
    return () => window.clearInterval(t);
  }, [autoRefresh]);

  return (
    <div className="pageGrid">
      <MapPreview pickup={preview?.pickup} dropoff={preview?.dropoff} />

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap:"wrap" }}>
          <div>
            <div className="h1">Available trips</div>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center", marginTop: 8 }}>
        <label style={{ display:"flex", gap:8, alignItems:"center" }}>
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
          <small className="muted">Auto refresh</small>
        </label>
      </div>
            <small className="muted">Preview, then accept (and jump to Mission).</small>
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            <input value={radius} onChange={(e) => setRadius(e.target.value)} style={{ width: 120 }} />
            <Button onClick={load} disabled={busy}>Refresh</Button>
            <Link to="/active"><Button>Mission</Button></Link>
          </div>
        </div>

        <Callout
          title="Tip"
          body="To see trips: go ONLINE (Dashboard) and set your location. Matching radius uses your last location."
        />

        {msg && <p style={{ color: "green" }}>{msg}</p>}
        <ErrorBanner message={err} />

        <hr />
        <table className="table">
          <thead>
            <tr>
              <th>Trip</th><th>Distance</th><th>Est.</th><th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(t => (
              <tr key={t.tripId} style={{ background: selected?.tripId === t.tripId ? "#fafafa" : "transparent" }}>
                <td>
                  <div style={{ fontWeight: 800 }}>{t.tripId.slice(0,8)}…</div>
                  <small className="muted">{t.pickup.lat.toFixed(4)}, {t.pickup.lng.toFixed(4)} → {t.dropoff.lat.toFixed(4)}, {t.dropoff.lng.toFixed(4)}</small>
                </td>
                <td>{t.distance_km} km</td>
                <td>{t.pricing.currency} {t.pricing.estimated_price}</td>
                <td style={{ whiteSpace:"nowrap" }}>
                  <Button onClick={() => setSelected(t)} disabled={busy}>Preview</Button>{" "}
                  <Button variant="primary" onClick={() => accept(t.tripId, true)} disabled={busy}>Accept & Go</Button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={4}><small className="muted">No available trips.</small></td></tr>
            )}
          </tbody>
        </table>

        {selected && (
          <>
            <hr />
            <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
              <Badge>Selected</Badge>
              <small className="muted">{selected.tripId}</small>
              <Badge>{selected.pricing.currency} {selected.pricing.estimated_price}</Badge>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
