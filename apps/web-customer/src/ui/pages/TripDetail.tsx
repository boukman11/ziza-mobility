import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "../../api";
import { keycloak } from "../../keycloak";
import ErrorBanner from "@shared/ui/ErrorBanner";
import Loader from "@shared/ui/Loader";
import Badge from "@shared/ui/Badge";
import Button from "@shared/ui/Button";
import Card from "@shared/ui/Card";
import { useToast } from "@shared/ui/Toast";

const ORDER = ["REQUESTED","ASSIGNED","ARRIVED","STARTED","COMPLETED","CANCELED"];

export default function TripDetail() {
  const toast = useToast();
  const { tripId } = useParams();
  const [trip, setTrip] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [receipt, setReceipt] = useState<any>(null);
  const [err, setErr] = useState("");
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);

  const status = useMemo(() => trip?.status as string | undefined, [trip]);

  async function load() {
    setErr(""); setReceipt(null);
    if (!keycloak.authenticated) { setErr("Login required."); toast.push("Login required.", "info"); return; }
    setBusy(true);
    try {
      const t = await apiFetch<any>(`/v1/customer/trips/${tripId}`, { method: "GET" });
      setTrip(t);

      const ev = await apiFetch<any>(`/v1/customer/trips/${tripId}/events?limit=500`, { method: "GET" });
      setEvents(ev.items || []);

      if (t.status === "COMPLETED") {
        try {
          const r = await apiFetch<any>(`/v1/customer/trips/${tripId}/receipt`, { method: "GET" });
          setReceipt(r);
        } catch {}
      }
    } catch (e: any) { setErr(e.message); toast.push(e.message, "error"); }
    finally { setBusy(false); }
  }

  async function cancel() {
    setErr("");
    try {
      await apiFetch<any>(`/v1/customer/trips/${tripId}/cancel`, { method: "POST" });
      toast.push("Cancel requested", "success");
      await load();
    } catch (e: any) { setErr(e.message); toast.push(e.message, "error"); }
  }

  useEffect(() => { load(); }, [tripId]);

  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(load, 4000);
    return () => window.clearInterval(id);
  }, [auto, tripId]);

  const currentIdx = status ? Math.max(0, ORDER.indexOf(status)) : 0;

  return (
    <div className="card">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontWeight: 800 }}>Trip detail</div>
          <small className="muted">{tripId}</small>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <Button onClick={load} disabled={busy}>Refresh</Button>
          <Button onClick={cancel} disabled={busy}>Cancel</Button>
          <Button onClick={() => setAuto((v) => !v)}>{auto ? "Auto: ON" : "Auto: OFF"}</Button>
        </div>
      </div>

      {busy && <Loader label="Refreshing…" />}
      <ErrorBanner message={err} />

      {trip && (
        <>
          <hr />
          {/* Status and basic pricing information */}
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            <Badge>{trip.status}</Badge>
            <small className="muted">{trip.currency} {(trip.final_price ?? trip.estimated_price)}</small>
          </div>

          {/* Status timeline */}
          <div style={{ marginTop: 10, display:"flex", gap:8, flexWrap:"wrap" }}>
            {ORDER.map((s, idx) => (
              <span key={s} className="badge" style={{ opacity: idx <= currentIdx ? 1 : 0.35 }}>{s}</span>
            ))}
          </div>

          {/* Detailed trip info */}
          <hr />
          <div style={{ fontWeight: 700 }}>Trip details</div>
          <div className="row">
            <Card>
              <div style={{ fontWeight: 800 }}>Pricing</div>
              <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>{trip.currency} {(trip.final_price ?? trip.estimated_price ?? "-")}</div>
              <small className="muted">Estimated until completion</small>
            </Card>
            <Card>
              <div style={{ fontWeight: 800 }}>Driver</div>
              <div style={{ marginTop: 6 }}>
                {trip.driverUserId ? <div>{String(trip.driverUserId).slice(0,8)}…</div> : <div className="muted">Not assigned yet</div>}
              </div>
              <small className="muted">Assigned driver</small>
            </Card>
            <Card>
              <div style={{ fontWeight: 800 }}>Distance / Duration</div>
              <div style={{ marginTop: 6, fontSize: 26, fontWeight: 900 }}>{trip.distance_km ?? "-"} km • {trip.duration_min ?? "-"} min</div>
              <small className="muted">Estimated</small>
            </Card>
          </div>

          {/* Pickup/Dropoff coordinates */}
          <div className="row" style={{ marginTop: 10 }}>
            <Card>
              <div style={{ fontWeight: 800 }}>Pickup</div>
              <div style={{ marginTop: 6 }}>{trip.pickup.lat.toFixed(4)}, {trip.pickup.lng.toFixed(4)}</div>
              <small className="muted">lat, lng</small>
            </Card>
            <Card>
              <div style={{ fontWeight: 800 }}>Dropoff</div>
              <div style={{ marginTop: 6 }}>{trip.dropoff.lat.toFixed(4)}, {trip.dropoff.lng.toFixed(4)}</div>
              <small className="muted">lat, lng</small>
            </Card>
          </div>

          {/* Events table */}
          <hr />
          <div style={{ fontWeight: 700 }}>Events</div>
          <table>
            <thead><tr><th>From</th><th>To</th><th>When</th></tr></thead>
            <tbody>
              {events.map((e: any) => (
                <tr key={e.id}>
                  <td><span className="badge">{e.from_status}</span></td>
                  <td><span className="badge">{e.to_status}</span></td>
                  <td><small className="muted">{new Date(e.created_at).toLocaleString()}</small></td>
                </tr>
              ))}
              {events.length === 0 && <tr><td colSpan={3}><small className="muted">No events.</small></td></tr>}
            </tbody>
          </table>

          {/* Receipt display (if completed) */}
          {receipt && (
            <>
              <hr />
              <div style={{ fontWeight: 700 }}>Receipt</div>
              <pre style={{ whiteSpace:"pre-wrap" }}>{JSON.stringify(receipt, null, 2)}</pre>
            </>
          )}

          <hr />
          <small className="muted"><Link to="/trips">← back to trips</Link></small>
        </>
      )}
    </div>
  );
}
