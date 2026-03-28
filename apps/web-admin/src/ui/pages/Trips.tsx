import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../api";
import { useToast } from "@shared/ui/Toast";
import ErrorBanner from "@shared/ui/ErrorBanner";
import { keycloak } from "../../keycloak";
import Button from "@shared/ui/Button";
import Card from "@shared/ui/Card";
import Badge from "@shared/ui/Badge";
import { Link } from "react-router-dom";

export default function Trips() {
  const toast = useToast();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    if (!keycloak.authenticated) { setErr("Login required."); return; }
    const qs = new URLSearchParams({ limit: "200", offset: "0" });
    if (status) qs.set("status", status);
    try {
      const res = await apiFetch<any>(`/v1/admin/trips?${qs.toString()}`, { method: "GET" });
      setItems(res.items || []);
    } catch (e:any) { setErr(e.message); toast.push(e.message, "error"); }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((t) => String(t.tripId || "").toLowerCase().includes(needle));
  }, [items, q]);

  return (
    <Card>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <div>
          <div style={{ fontWeight: 800 }}>Trips</div>
          <small className="muted">Filter by status (API) + search by TripId (client)</small>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="status (optional)" style={{ width: 220 }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search trip id…" style={{ width: 240 }} />
          <Button onClick={load}>Refresh</Button>
        </div>
      </div>

      <ErrorBanner message={err} />

      <hr />
      <table className="table">
        <thead><tr><th>Trip</th><th>Status</th><th>Price</th><th>Customer</th><th>Driver</th><th>Created</th></tr></thead>
        <tbody>
          {filtered.map(t => (
            <tr key={t.tripId}>
              <td><Link to={`/trips/${t.tripId}`}>{t.tripId.slice(0,8)}…</Link></td>
              <td><Badge>{t.status}</Badge></td>
              <td>{t.currency} {(t.final_price ?? t.estimated_price)}</td>
              <td><small className="muted">{(t.customerUserId||"").slice(0,8)}…</small></td>
              <td><small className="muted">{t.driverUserId ? t.driverUserId.slice(0,8)+"…" : "-"}</small></td>
              <td><small className="muted">{new Date(t.created_at).toLocaleString()}</small></td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan={6}><small className="muted">No trips.</small></td></tr>}
        </tbody>
      </table>
    </Card>
  );
}
