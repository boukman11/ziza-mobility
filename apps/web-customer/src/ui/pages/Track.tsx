import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../../api";
import { keycloak, login } from "../../keycloak";
import { useToast } from "@shared/ui/Toast";
import ErrorBanner from "@shared/ui/ErrorBanner";
import Loader from "@shared/ui/Loader";
import Card from "@shared/ui/Card";
import Button from "@shared/ui/Button";
import Badge from "@shared/ui/Badge";
import MapPreview from "@shared/ui/MapPreview";
import StatusTimeline from "@shared/ui/StatusTimeline";

const ORDER = ["REQUESTED","ASSIGNED","ARRIVED","STARTED","COMPLETED","CANCELED"];

function canCancel(status?: string) {
  return status && !["COMPLETED","CANCELED"].includes(status);
}

export default function Track() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [trip, setTrip] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [receipt, setReceipt] = useState<any>(null);

  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  /**
   * Timestamp of the most recent successful data refresh. This is updated
   * whenever the trip and event data are successfully loaded. It is
   * displayed to the user so they know when the latest data was retrieved.
   */
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const status = useMemo(() => trip?.status as string | undefined, [trip]);
  const pickup = useMemo(() => {
    if (!trip) return undefined;
    return trip.pickup || (trip.pickup_lat != null ? { lat: trip.pickup_lat, lng: trip.pickup_lng } : undefined);
  }, [trip]);
  const dropoff = useMemo(() => {
    if (!trip) return undefined;
    return trip.dropoff || (trip.dropoff_lat != null ? { lat: trip.dropoff_lat, lng: trip.dropoff_lng } : undefined);
  }, [trip]);

  async function load() {
    if (!tripId) return;
    setErr("");
    if (!keycloak.authenticated) {
      setErr("Login required.");
      return;
    }
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
        } catch {
          setReceipt(null);
        }
      } else {
        setReceipt(null);
      }
      // record when we last successfully refreshed the trip and event data
      setLastUpdated(new Date());
    } catch (e:any) {
      setErr(e.message);
      toast.push(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!tripId) return;
    setErr("");
    if (!keycloak.authenticated) { toast.push("Login required.", "info"); login(); return; }
    try {
      await apiFetch<any>(`/v1/customer/trips/${tripId}/cancel`, { method: "POST" });
      toast.push("Trip canceled (or cancel requested)", "success");
      await load();
    } catch (e:any) {
      setErr(e.message);
      toast.push(e.message, "error");
    }
  }

  useEffect(() => { load(); }, [tripId]);

  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(load, 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, tripId]);

  const headline = useMemo(() => {
    switch (status) {
      case "REQUESTED": return "Looking for a driver…";
      case "ASSIGNED": return "Driver assigned — heading to pickup";
      case "ARRIVED": return "Driver arrived";
      case "STARTED": return "On the way";
      case "COMPLETED": return "Trip completed";
      case "CANCELED": return "Trip canceled";
      default: return "Trip status";
    }
  }, [status]);

  return (
    <div className="pageGrid">
      <MapPreview pickup={pickup} dropoff={dropoff} />

      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
          <div>
            <div className="h1">Ride tracking</div>
      <small className="muted">Step 3 of 3 • Track</small>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center", marginTop: 10 }}>
        <label style={{ display:"flex", gap:8, alignItems:"center" }}>
          {/*
           * Use the `auto` state to control automatic refreshing. When the
           * checkbox changes, update the `auto` flag accordingly. This used
           * to reference `autoRefresh`/`setAutoRefresh` which were undefined.
           */}
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          <small className="muted">Auto refresh</small>
        </label>
        {/* Display the time of the last successful refresh if available */}
        {lastUpdated && <small className="muted">Last update: {lastUpdated.toLocaleTimeString()}</small>}
      </div>
            <small className="muted">{tripId}</small>
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <Button onClick={() => navigate("/trips")}>Back</Button>
            <Button onClick={load} disabled={busy}>Refresh</Button>
            <Button onClick={() => setAuto(v => !v)}>{auto ? "Auto: ON" : "Auto: OFF"}</Button>
            <Link to={`/trips/${tripId}`}><Button>Debug</Button></Link>
          </div>
        </div>

        {!keycloak.authenticated && (
          <>
            <hr />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
              <div>
                <div style={{ fontWeight: 800 }}>Login required</div>
                <small className="muted">You must login to track your trip.</small>
              </div>
              <Button variant="primary" onClick={() => login()}>Login</Button>
            </div>
          </>
        )}

        {busy && <div style={{ marginTop: 10 }}><Loader label="Refreshing…" /></div>}
        <ErrorBanner message={err} />

        {trip && (
          <>
            <hr />
            <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
              <Badge>{trip.status}</Badge>
              <div style={{ fontWeight: 800 }}>{headline}</div>
            </div>

            <div style={{ marginTop: 10 }}>
              <StatusTimeline order={ORDER} current={status} />
            </div>

            <hr />
            <div className="row">
              <Card className="">
                <div style={{ fontWeight: 800 }}>Price</div>
                <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>
                  {trip.currency} {(trip.final_price ?? trip.estimated_price ?? "-")}
                </div>
                <small className="muted">Estimate until completion</small>
              </Card>

              <Card className="">
                <div style={{ fontWeight: 800 }}>Driver</div>
                <div style={{ marginTop: 6 }}>
                  {trip.driverUserId ? (
                    <div style={{ fontWeight: 800 }}>{String(trip.driverUserId).slice(0, 8)}…</div>
                  ) : (
                    <div className="muted">Not assigned yet</div>
                  )}
                </div>
                <small className="muted">Sprint 28: contact button</small>
              </Card>

              <Card className="">
                <div style={{ fontWeight: 800 }}>Distance / Duration</div>
                <div style={{ marginTop: 6, fontWeight: 900 }}>
                  {trip.distance_km ?? "-"} km • {trip.duration_min ?? "-"} min
                </div>
                <small className="muted">Estimated</small>
              </Card>
            </div>

            <hr />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
              <div style={{ fontWeight: 800 }}>Actions</div>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                <Button variant="primary" onClick={cancel} disabled={!canCancel(status) || busy}>Cancel trip</Button>
              </div>
            </div>
            <small className="muted">Cancel available until completion.</small>

            <hr />
            <div style={{ fontWeight: 800 }}>Latest updates</div>
            <table className="table">
              <thead><tr><th>From</th><th>To</th><th>When</th></tr></thead>
              <tbody>
                {events.slice().reverse().slice(0, 12).map((e:any) => (
                  <tr key={e.id}>
                    <td><span className="badge">{e.from_status}</span></td>
                    <td><span className="badge">{e.to_status}</span></td>
                    <td><small className="muted">{new Date(e.created_at).toLocaleString()}</small></td>
                  </tr>
                ))}
                {events.length === 0 && <tr><td colSpan={3}><small className="muted">No events yet.</small></td></tr>}
              </tbody>
            </table>

            {receipt && (
              <>
                <hr />
                <div style={{ fontWeight: 800 }}>Receipt</div>
                <div className="row">
                  <Card>
                    <div style={{ fontWeight: 800 }}>Total</div>
                    <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>{receipt.currency} {receipt.total}</div>
                    <small className="muted">Paid</small>
                  </Card>
                  <Card>
                    <div style={{ fontWeight: 800 }}>Breakdown</div>
                    <pre style={{ whiteSpace:"pre-wrap", marginBottom:0 }}>{JSON.stringify(receipt, null, 2)}</pre>
                  </Card>
                </div>
              </>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
