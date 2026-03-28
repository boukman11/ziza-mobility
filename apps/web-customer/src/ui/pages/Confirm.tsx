import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import Card from "@shared/ui/Card";
import Button from "@shared/ui/Button";
import ErrorBanner from "@shared/ui/ErrorBanner";
import Loader from "@shared/ui/Loader";
import MapPreview from "@shared/ui/MapPreview";
import { useToast } from "@shared/ui/Toast";
import { apiFetch } from "../../api";
import { keycloak } from "../../keycloak";

type LatLng = { lat: number; lng: number };

export default function Confirm() {
  const nav = useNavigate();
  const toast = useToast();
  const loc = useLocation() as any;

  const pickup: LatLng | undefined = loc.state?.pickup;
  const dropoff: LatLng | undefined = loc.state?.dropoff;

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const summary = useMemo(() => {
    if (!pickup || !dropoff) return null;
    return {
      pickup,
      dropoff,
      distanceKm: Math.max(1, Math.round((Math.random() * 8 + 2) * 10) / 10), // placeholder until we expose estimate details
      etaMin: Math.round(Math.random() * 6 + 4),
    };
  }, [pickup, dropoff]);

  async function confirmRide() {
    if (!summary) return;
    setBusy(true);
    setErr("");
    try {
      const res = await apiFetch<any>("/v1/customer/trips", {
        method: "POST",
        body: JSON.stringify({ pickup: summary.pickup, dropoff: summary.dropoff }),
      });
      const tripId = res.tripId || res.trip_id || res.id;
      toast.push("Ride created", "success");
      nav("/track", { state: { tripId } });
    } catch (e: any) {
      setErr(e.message);
      toast.push(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (!keycloak.authenticated) {
    return (
      <Card>
        <div className="h1">Login required</div>
        <p className="muted">Please login from the top bar, then retry.</p>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card>
        <div className="h1">Nothing to confirm</div>
        <p className="muted">Go back to Estimate and pick pickup/dropoff first.</p>
        <Link to="/estimate"><Button variant="primary">Back to Estimate</Button></Link>
      </Card>
    );
  }

  return (
    <div className="pageGrid">
      <Card>
        <div className="h1">Confirm your ride</div>
        <small className="muted">Step 2 of 3 • Confirm</small>

        <div style={{ marginTop: 14 }} />

        <div className="kv"><span className="muted">Estimated distance</span><b>{summary.distanceKm} km</b></div>
        <div className="kv"><span className="muted">ETA</span><b>{summary.etaMin} min</b></div>

        <ErrorBanner message={err} />
        {busy && <Loader label="Creating ride…" />}

        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginTop: 14 }}>
          <Button onClick={() => nav("/estimate", { state: { pickup, dropoff } })}>Back</Button>
          <Button variant="primary" onClick={confirmRide} disabled={busy}>Confirm ride</Button>
        </div>
      </Card>

      <MapPreview pickup={pickup} dropoff={dropoff} title="Map preview" />
    </div>
  );
}
