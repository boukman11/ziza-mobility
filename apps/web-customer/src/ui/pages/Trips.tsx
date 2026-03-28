import React, { useEffect, useState } from "react";
import { useToast } from "@shared/ui/Toast";
import ErrorBanner from "@shared/ui/ErrorBanner";
import { Link } from "react-router-dom";
import { apiFetch } from "../../api";
import { keycloak } from "../../keycloak";

type TripRow = {
  tripId: string;
  status: string;
  driverUserId: string | null;
  currency: string;
  estimated_price: number;
  final_price: number | null;
};

export default function Trips() {
  const [items, setItems] = useState<TripRow[]>([]);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");
  const toast = useToast();

  async function load() {
    setErr("");
    if (!keycloak.authenticated) { setErr("Login required."); return; }
    try {
      const qs = new URLSearchParams({ limit: "50", offset: "0" });
      if (status) qs.set("status", status);
      const res = await apiFetch<any>(`/v1/customer/trips?${qs.toString()}`, { method: "GET" });
      setItems(res.items || []);
    } catch (e: any) {
      setErr(e.message);
      toast.push(e.message, "error");
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>Trips</div>
        <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="status (optional)" style={{ width: 220 }} />
        <button onClick={load}>Refresh</button>
      </div>
      <ErrorBanner message={err} />
      <table>
        <thead>
          <tr>
            <th>Trip (track)</th><th>Status</th><th>Price</th><th>Driver</th><th>Details</th>
          </tr>
        </thead>
        <tbody>
          {items.map(t => (
            <tr key={t.tripId}>
              <td><Link to={`/track/${t.tripId}`}>{t.tripId.slice(0,8)}…</Link></td>
              <td><span className="badge">{t.status}</span></td>
              <td>{t.currency} {t.final_price ?? t.estimated_price}</td>
              <td>{t.driverUserId ? t.driverUserId.slice(0,8)+"…" : "-"}</td>
              <td><Link to={`/trips/${t.tripId}`}>Details</Link></td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={5}><small className="muted">No trips yet.</small></td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
