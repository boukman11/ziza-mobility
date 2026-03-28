import React, { useEffect, useState } from "react";
import Card from "@shared/ui/Card";
import Button from "@shared/ui/Button";
import ErrorBanner from "@shared/ui/ErrorBanner";
import Loader from "@shared/ui/Loader";
import MapPreview from "@shared/ui/MapPreview";
import Badge from "@shared/ui/Badge";
import { useToast } from "@shared/ui/Toast";
import { apiFetch } from "../../api";
import { keycloak } from "../../keycloak";

export default function AssistancePage() {
  const toast = useToast();
  const [lat, setLat] = useState("40.7357");
  const [lng, setLng] = useState("-74.1724");
  const [note, setNote] = useState("Flat tire");
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    if (!keycloak.authenticated) return;
    try {
      // Backend expects plural 'assistances'
      const res = await apiFetch<any>("/v1/customer/assistances?limit=50&offset=0", { method: "GET" });
      setItems(res.items || []);
    } catch (e:any) {
      setErr(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function submit() {
    setBusy(true);
    setErr("");
    try {
      // Backend expects plural 'assistances'
      await apiFetch<any>("/v1/customer/assistances", {
        method: "POST",
        body: JSON.stringify({ lat: Number(lat), lng: Number(lng), note }),
      });
      toast.push("Assistance requested", "success");
      await load();
    } catch (e:any) {
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
        <p className="muted">Please login from the top bar.</p>
      </Card>
    );
  }

  const pickup = { lat: Number(lat), lng: Number(lng) };

  return (
    <div className="pageGrid">
      <Card>
        <div className="h1">Roadside assistance</div>
        <small className="muted">Request help (MVP).</small>

        <ErrorBanner message={err} />
        {busy && <Loader label="Submitting…" />}

        <div style={{ display:"grid", gap:10, marginTop: 12 }}>
          <label>
            <small className="muted">Latitude</small>
            <input value={lat} onChange={(e) => setLat(e.target.value)} />
          </label>
          <label>
            <small className="muted">Longitude</small>
            <input value={lng} onChange={(e) => setLng(e.target.value)} />
          </label>
          <label>
            <small className="muted">Issue</small>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>

        <div style={{ marginTop: 12 }}>
          <Button variant="primary" onClick={submit} disabled={busy}>Request assistance</Button>
        </div>

        <hr />
        <div className="h2">My requests</div>
        <table className="table" style={{ marginTop: 12 }}>
          <thead><tr><th>Status</th><th>Note</th><th>Created</th></tr></thead>
          <tbody>
            {items.map((x:any) => (
              <tr key={x.id}>
                <td><Badge>{x.status}</Badge></td>
                <td>{x.note || "-"}</td>
                <td><small className="muted">{new Date(x.created_at).toLocaleString()}</small></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={3}><small className="muted">No requests yet.</small></td></tr>}
          </tbody>
        </table>
      </Card>

      <MapPreview pickup={pickup} title="Your location (preview)" />
    </div>
  );
}
