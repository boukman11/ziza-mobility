import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../api";
import { keycloak } from "../../keycloak";
import { useToast } from "@shared/ui/Toast";
import ErrorBanner from "@shared/ui/ErrorBanner";
import Card from "@shared/ui/Card";
import Button from "@shared/ui/Button";
import Badge from "@shared/ui/Badge";
import Loader from "@shared/ui/Loader";
import MapPreview from "@shared/ui/MapPreview";
import StatusTimeline from "@shared/ui/StatusTimeline";
import Callout from "@shared/ui/Callout";
import { Link } from "react-router-dom";

const ORDER = ["ASSIGNED","ARRIVED","STARTED","COMPLETED","CANCELED"];

function nextAction(status?: string): { label: string; action: "arrived" | "start" | "complete" | "none" } {
  switch (status) {
    case "ASSIGNED": return { label: "Go to pickup, then tap ARRIVED.", action: "arrived" };
    case "ARRIVED":  return { label: "Customer onboard? Tap START.", action: "start" };
    case "STARTED":  return { label: "At destination? Tap COMPLETE.", action: "complete" };
    case "COMPLETED": return { label: "Trip completed. Check earnings.", action: "none" };
    case "CANCELED": return { label: "Trip canceled.", action: "none" };
    default: return { label: "Accept a trip to start a mission.", action: "none" };
  }
}

function can(status: string | undefined, a: "arrived"|"start"|"complete") {
  if (!status) return false;
  if (status === "CANCELED" || status === "COMPLETED") return false;
  if (a === "arrived") return status === "ASSIGNED";
  if (a === "start") return status === "ARRIVED";
  if (a === "complete") return status === "STARTED";
  return false;
}

export default function ActiveTrip() {
  const toast = useToast();
  const [active, setActive] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [auto, setAuto] = useState(true);
  /**
   * Timestamp of the most recent successful data refresh for the active trip.
   * Updated whenever the driver active trip and event list are fetched.
   */
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);

  const tripId = useMemo(() => active?.tripId as string | undefined, [active]);
  const status = useMemo(() => active?.status as string | undefined, [active]);
  const hint = useMemo(() => nextAction(status), [status]);

  async function load() {
    setErr(""); setMsg(""); setBusy(true);
    if (!keycloak.authenticated) { setErr("Login required."); setBusy(false); return; }
    try {
      const res = await apiFetch<any>("/v1/driver/trips/active", { method: "GET" });
      const a = res.active || null;
      setActive(a);
      if (a?.tripId) {
        const ev = await apiFetch<any>(`/v1/driver/trips/${a.tripId}/events?limit=500`, { method: "GET" });
        setEvents(ev.items || []);
      } else {
        setEvents([]);
      }
      // update last refresh timestamp after successful fetch
      setLastUpdated(new Date());
    } catch (e: any) { setErr(e.message); toast.push(e.message, "error"); }
    finally { setBusy(false); }
  }

  async function act(action: "arrived"|"start"|"complete") {
    if (!tripId) return;
    setErr(""); setMsg(""); setBusy(true);
    try {
      if (action === "complete") {
        await apiFetch<any>(`/v1/driver/trips/${tripId}/complete`, { method: "POST", body: JSON.stringify({}) });
      } else {
        await apiFetch<any>(`/v1/driver/trips/${tripId}/${action}`, { method: "POST" });
      }
      setMsg(`Action '${action}' sent`);
      toast.push(`Action '${action}' sent`, "success");
      await load();
    } catch (e: any) { setErr(e.message); toast.push(e.message, "error"); }
    finally { setBusy(false); }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(load, 3000);
    return () => window.clearInterval(id);
  }, [auto]);

  const pickup = active?.pickup || (active?.pickup_lat != null ? { lat: active.pickup_lat, lng: active.pickup_lng } : undefined);
  const dropoff = active?.dropoff || (active?.dropoff_lat != null ? { lat: active.dropoff_lat, lng: active.dropoff_lng } : undefined);

  return (
    <div className="pageGrid">
      <MapPreview pickup={pickup} dropoff={dropoff} />

      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
          <div>
            <div className="h1">Mission</div>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center", marginTop: 8 }}>
        <label style={{ display:"flex", gap:8, alignItems:"center" }}>
          {/*
           * Control automatic refresh with the `auto` flag. Toggle it when the
           * checkbox is changed. The previous code referenced undefined
           * variables `autoRefresh` and `setAutoRefresh` which caused a build
           * error.
           */}
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          <small className="muted">Auto refresh</small>
        </label>
        {/* Show timestamp of last successful refresh if available */}
        {lastUpdated && <small className="muted">Last update: {lastUpdated.toLocaleTimeString()}</small>}
      </div>
            <small className="muted">Guided flow: Arrived → Start → Complete</small>
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <Link to="/availability"><Button>Available trips</Button></Link>
            <Link to="/earnings"><Button>Earnings</Button></Link>
            <Button onClick={load} disabled={busy}>Refresh</Button>
            <Button onClick={() => setAuto(v => !v)}>{auto ? "Auto: ON" : "Auto: OFF"}</Button>
          </div>
        </div>

        {busy && <Loader label="Refreshing…" />}
        {msg && <p style={{ color:"green" }}>{msg}</p>}
        <ErrorBanner message={err} />

        {!active && !err && (
          <>
            <hr />
            <Callout title="No active mission" body="Accept a trip from Available trips to start." />
          </>
        )}

        {active && (
          <>
            <hr />
            <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
              <Badge>Trip</Badge>
              <small className="muted">{active.tripId}</small>
              <Badge>{active.status}</Badge>
            </div>

            <div style={{ marginTop: 10 }}>
              <StatusTimeline order={ORDER} current={active.status} />
            </div>

            <hr />
            <Callout title="Next step" body={hint.label} />

            <div style={{ fontWeight: 800, marginTop: 10 }}>Actions</div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginTop: 10 }}>
              <Button onClick={() => act("arrived")} disabled={busy || !can(status,"arrived")}>Arrived</Button>
              <Button onClick={() => act("start")} disabled={busy || !can(status,"start")}>Start</Button>
              <Button variant="primary" onClick={() => act("complete")} disabled={busy || !can(status,"complete")}>Complete</Button>
            </div>
            <small className="muted">Buttons enable only when valid for current status.</small>

            <hr />
            <div style={{ fontWeight: 800 }}>Events</div>
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
                {events.length === 0 && <tr><td colSpan={3}><small className="muted">No events yet.</small></td></tr>}
              </tbody>
            </table>
          </>
        )}
      </Card>
    </div>
  );
}
