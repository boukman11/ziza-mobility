import React, { useEffect, useState } from "react";
import { apiFetch } from "../../api";
import { useToast } from "@shared/ui/Toast";
import ErrorBanner from "@shared/ui/ErrorBanner";
import { keycloak } from "../../keycloak";

export default function Payments() {
  const [items, setItems] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const toast = useToast();

  async function load() {
    setErr("");
    if (!keycloak.authenticated) { setErr("Login required."); return; }
    try {
      const res = await apiFetch<any>("/v1/admin/payments?limit=200&offset=0", { method: "GET" });
      setItems(res.items || []);
    } catch (e:any) { setErr(e.message);
      toast.push(e.message, "error"); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="card">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontWeight: 700 }}>Payments</div>
        <button onClick={load}>Refresh</button>
      </div>
      <ErrorBanner message={err} />

      <table>
        <thead><tr><th>Payment</th><th>Trip</th><th>Status</th><th>Amount</th><th>Provider</th><th>Created</th></tr></thead>
        <tbody>
          {items.map(p => (
            <tr key={p.id}>
              <td><small className="muted">{p.id.slice(0,8)}…</small></td>
              <td><small className="muted">{p.trip_id ? p.trip_id.slice(0,8)+"…" : "-"}</small></td>
              <td><span className="badge">{p.status}</span></td>
              <td>{p.currency} {p.amount}</td>
              <td><small className="muted">{p.provider}</small></td>
              <td><small className="muted">{new Date(p.created_at).toLocaleString()}</small></td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={6}><small className="muted">No payments.</small></td></tr>}
        </tbody>
      </table>
    </div>
  );
}
