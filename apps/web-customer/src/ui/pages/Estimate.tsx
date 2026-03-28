import React, { useEffect, useMemo, useState } from "react";
import { apiFetch, uuidv4 } from "../../api";
import { keycloak, login } from "../../keycloak";
import MapPreview from "@shared/ui/MapPreview";
import ErrorBanner from "@shared/ui/ErrorBanner";
import Loader from "@shared/ui/Loader";
import Stepper from "@shared/ui/Stepper";
import Button from "@shared/ui/Button";
import Card from "@shared/ui/Card";
import Badge from "@shared/ui/Badge";
import { useToast } from "@shared/ui/Toast";
import {Link, useNavigate} from "react-router-dom";

type EstimateRes = {
  currency: string;
  distance_km: number;
  duration_min: number;
  estimated_price: number;
  pricing: any;
};

export default function Estimate() {
  const nav = useNavigate();
  const toast = useToast();

  const [pickupLat, setPickupLat] = useState("40.7357");
  const [pickupLng, setPickupLng] = useState("-74.1724");
  const [dropLat, setDropLat] = useState("40.7300");
  const [dropLng, setDropLng] = useState("-74.1400");

  const pickup = useMemo(() => ({ lat: Number(pickupLat), lng: Number(pickupLng) }), [pickupLat, pickupLng]);
  const dropoff = useMemo(() => ({ lat: Number(dropLat), lng: Number(dropLng) }), [dropLat, dropLng]);

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const steps = ["Pick points", "Estimate", "Track"];

  const [estimate, setEstimate] = useState<EstimateRes | null>(null);
  const [createdTripId, setCreatedTripId] = useState<string | null>(null);
  const [trip, setTrip] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  function useSample() {
    setPickupLat("40.7357"); setPickupLng("-74.1724");
    setDropLat("40.7420"); setDropLng("-74.0324");
    toast.push("Sample coordinates loaded", "info");
  }

  function swap() {
    setPickupLat(dropLat); setPickupLng(dropLng);
    setDropLat(pickupLat); setDropLng(pickupLng);
    toast.push("Pickup/dropoff swapped", "info");
  }

  async function doEstimate() {
    setErr(""); setBusy(true);
    try {
      const res = await apiFetch<EstimateRes>("/v1/customer/trips/estimate", {
        method: "POST",
        body: JSON.stringify({ pickup, dropoff }),
      });
      setEstimate(res);
      setStep(1);
      toast.push("Estimate ready", "success");
    } catch (e: any) {
      setErr(e.message);
      toast.push(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function createTrip() {
    setErr("");
    if (!keycloak.authenticated) {
      toast.push("Login required to create a trip", "info");
      login();
      return;
    }
    if (!estimate) {
      toast.push("Please get an estimate first", "info");
      return;
    }
    setBusy(true);
    try {
      const idem = uuidv4();
      const res = await apiFetch<any>("/v1/customer/trips", {
        method: "POST",
        headers: { "Idempotency-Key": idem },
        body: JSON.stringify({ pickup, dropoff }),
      });
      const tid = res?.tripId || res?.trip_id || res?.id;
      setCreatedTripId(tid);
      setStep(2);
      toast.push("Trip created", "success");
    } catch (e: any) {
      setErr(e.message);
      toast.push(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function refreshTrip() {
    if (!createdTripId) return;
    try {
      const t = await apiFetch<any>(`/v1/customer/trips/${createdTripId}`, { method: "GET" });
      setTrip(t);
      const ev = await apiFetch<any>(`/v1/customer/trips/${createdTripId}/events?limit=200`, { method: "GET" });
      setEvents(ev.items || []);
    } catch (e: any) {
      // do not spam
    }
  }

  useEffect(() => {
    if (!createdTripId) return;
    refreshTrip();
    const id = window.setInterval(refreshTrip, 3000);
    return () => window.clearInterval(id);
  }, [createdTripId]);

  return (
    <div className="pageGrid">
      <MapPreview pickup={pickup} dropoff={dropoff} />

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="h1">Request a ride</div>
      <small className="muted">Step 1 of 3 • Estimate</small>
            <small className="muted">Step-by-step: estimate → create → track</small>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={useSample}>Use sample</Button>
            <Button onClick={swap}>Swap</Button>
          </div>
        </div>

        <hr />
        <Stepper steps={steps} current={step} />

        <hr />
        {busy && <Loader label="Working…" />}

        <ErrorBanner message={err} />

        {step === 0 && (
          <>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Pickup / Dropoff</div>
            <div className="row">
              <div>
                <div style={{ fontWeight: 600 }}>Pickup</div>
                <div className="row">
                  <input value={pickupLat} onChange={(e) => setPickupLat(e.target.value)} placeholder="lat" />
                  <input value={pickupLng} onChange={(e) => setPickupLng(e.target.value)} placeholder="lng" />
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>Dropoff</div>
                <div className="row">
                  <input value={dropLat} onChange={(e) => setDropLat(e.target.value)} placeholder="lat" />
                  <input value={dropLng} onChange={(e) => setDropLng(e.target.value)} placeholder="lng" />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <Button variant="primary" onClick={doEstimate} disabled={busy}>Next: Estimate</Button>
            </div>
          </>
        )}

        {step === 1 && estimate && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontWeight: 700 }}>Estimate</div>
              <div style={{ display: "flex", gap: 10 }}>
                <Button onClick={() => setStep(0)} disabled={busy}>Back</Button>
                <Button variant="primary" onClick={createTrip} disabled={busy}>Confirm & Create</Button>
              </div>
            </div>

            <hr />
            <div className="row">
              <Card className="">
                <div style={{ fontWeight: 700 }}>Price</div>
                <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{estimate.currency} {estimate.estimated_price}</div>
                <small className="muted">Estimated</small>
              </Card>
              <Card className="">
                <div style={{ fontWeight: 700 }}>Distance</div>
                <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{estimate.distance_km} km</div>
                <small className="muted">Approx.</small>
              </Card>
              <Card className="">
                <div style={{ fontWeight: 700 }}>Duration</div>
                <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{estimate.duration_min} min</div>
                <small className="muted">Approx.</small>
              </Card>
            </div>

            {!keycloak.authenticated && (
              <p className="muted" style={{ marginTop: 10 }}>
                You can estimate without login, but you must login to create a trip.
              </p>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontWeight: 700 }}>Tracking</div>
              <div style={{ display: "flex", gap: 10 }}>
                <Button onClick={refreshTrip}>Refresh</Button>
                <Link to="/trips"><Button>Trips</Button></Link>
                {createdTripId && <Link to={`/track/${createdTripId}`}><Button variant="primary">Open tracking page</Button></Link>}
              </div>
            </div>

            <hr />
            {!createdTripId && <small className="muted">No trip created yet.</small>}

            {createdTripId && (
              <>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <Badge>Trip</Badge>
                  <small className="muted">{createdTripId}</small>
                  {trip?.status && <Badge>{trip.status}</Badge>}
                </div>

                <hr />
                <div style={{ fontWeight: 700 }}>Snapshot (debug)</div>
                <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(trip, null, 2)}</pre>

                <hr />
                <div style={{ fontWeight: 700 }}>Events</div>
                <table className="table">
                  <thead><tr><th>From</th><th>To</th><th>When</th></tr></thead>
                  <tbody>
                    {events.map((e: any) => (
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
          </>
        )}
      </Card>
    </div>
  );
}
