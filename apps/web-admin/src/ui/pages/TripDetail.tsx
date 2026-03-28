import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "../../api";
import { useToast } from "@shared/ui/Toast";
import ErrorBanner from "@shared/ui/ErrorBanner";
import { keycloak } from "../../keycloak";
import Card from "@shared/ui/Card";
import Button from "@shared/ui/Button";
import Badge from "@shared/ui/Badge";
import Loader from "@shared/ui/Loader";
import MapPreview from "@shared/ui/MapPreview";
import StatusTimeline from "@shared/ui/StatusTimeline";

const ORDER = ["REQUESTED","ASSIGNED","ARRIVED","STARTED","COMPLETED","CANCELED"];

export default function TripDetail() {
  const toast = useToast();
  const { tripId } = useParams();
  const [trip, setTrip] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);

  const status = useMemo(() => trip?.status as string | undefined, [trip]);

  async function load() {
    setErr("");
    if (!keycloak.authenticated) { setErr("Login required."); return; }
    setBusy(true);
    try {
      const t = await apiFetch<any>(`/v1/admin/trips/${tripId}`, { method: "GET" });
      setTrip(t);
      const ev = await apiFetch<any>(`/v1/admin/trips/${tripId}/events?limit=500`, { method: "GET" });
      setEvents(ev.items || []);
    } catch (e:any) { setErr(e.message); toast.push(e.message, "error"); }
    finally { setBusy(false); }
  }

  useEffect(() => { load(); }, [tripId]);

  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(load, 4000);
    return () => window.clearInterval(id);
  }, [auto, tripId]);

  return (
    <div className="pageGrid">
      <MapPreview pickup={trip?.pickup} dropoff={trip?.dropoff} />

      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
          <div>
            <div style={{ fontWeight:800 }}>Trip detail</div>
            <small className="muted">{tripId}</small>
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <Button onClick={load} disabled={busy}>Refresh</Button>
            <Button onClick={() => setAuto(v => !v)}>{auto ? "Auto: ON" : "Auto: OFF"}</Button>
            <Link to="/trips"><Button>Back</Button></Link>
          </div>
        </div>

        {busy && <Loader label="Refreshing…" />}
        <ErrorBanner message={err} />

        {trip && (
          <>
            <hr />
            {/* Trip status and pricing overview */}
            <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
              <Badge>{trip.status}</Badge>
              <small className="muted">{trip.currency} {(trip.final_price ?? trip.estimated_price)}</small>
              {trip.driverUserId && <small className="muted">Driver: {trip.driverUserId.slice(0,8)}…</small>}
            </div>

            {/* Status timeline */}
            <div style={{ marginTop: 10 }}>
              <StatusTimeline order={ORDER} current={status} />
            </div>

            {/* High-level trip details */}
            <hr />
            <div style={{ fontWeight: 700 }}>Trip details</div>
            <div className="row">
              <Card>
                <div style={{ fontWeight: 800 }}>Pricing</div>
                <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>{trip.currency} {(trip.final_price ?? trip.estimated_price ?? "-")}</div>
                <small className="muted">Estimated until completion</small>
              </Card>
              <Card>
                <div style={{ fontWeight: 800 }}>Customer / Driver</div>
                <div style={{ marginTop: 6 }}>
                  <div>Customer: {trip.customerUserId.slice(0, 8)}…</div>
                  <div>Driver: {trip.driverUserId ? trip.driverUserId.slice(0, 8) + "…" : "-"}</div>
                </div>
                <small className="muted">User identifiers</small>
              </Card>
              <Card>
                <div style={{ fontWeight: 800 }}>Distance / Duration</div>
                <div style={{ marginTop: 6, fontSize: 26, fontWeight: 900 }}>{trip.distance_km ?? "-"} km • {trip.duration_min ?? "-"} min</div>
                <small className="muted">Estimated</small>
              </Card>
            </div>

            {/* Trip pickup/dropoff coordinates */}
            <div className="row" style={{ marginTop: 10 }}>
              <Card>
                <div style={{ fontWeight: 800 }}>Pickup location</div>
                <div style={{ marginTop: 6 }}>{trip.pickup.lat.toFixed(4)}, {trip.pickup.lng.toFixed(4)}</div>
                <small className="muted">lat, lng</small>
              </Card>
              <Card>
                <div style={{ fontWeight: 800 }}>Dropoff location</div>
                <div style={{ marginTop: 6 }}>{trip.dropoff.lat.toFixed(4)}, {trip.dropoff.lng.toFixed(4)}</div>
                <small className="muted">lat, lng</small>
              </Card>
            </div>

            {/* Events table */}
            <hr />
            <div style={{ fontWeight: 700 }}>Events</div>
            <table className="table">
              <thead><tr><th>From</th><th>To</th><th>When</th></tr></thead>
              <tbody>
                {events.map((e:any) => (
                  <tr key={e.id}>
                    <td><span className="badge">{e.from_status}</span></td>
                    <td><span className="badge">{e.to_status}</span></td>
                    <td><small className="muted">{new Date(e.created_at).toLocaleString()}</small></td>
                  </tr>
                ))}
                {events.length === 0 && <tr><td colSpan={3}><small className="muted">No events.</small></td></tr>}
              </tbody>
            </table>
          </>
        )}
      </Card>
    </div>
  );
}
