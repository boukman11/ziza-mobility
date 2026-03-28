import React, { useEffect, useState } from "react";
import { apiFetch } from "../../api";
import { useToast } from "@shared/ui/Toast";
import ErrorBanner from "@shared/ui/ErrorBanner";
import { keycloak } from "../../keycloak";

export default function Assistances() {
  const [items, setItems] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const toast = useToast();

  async function load() {
    setErr("");
    if (!keycloak.authenticated) { setErr("Login required."); return; }
    try {
      const res = await apiFetch<any>("/v1/admin/assistances?limit=200&offset=0", { method: "GET" });
      setItems(res.items || []);
    } catch (e:any) { setErr(e.message);
      toast.push(e.message, "error"); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="card">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontWeight: 700 }}>Assistances</div>
        <button onClick={load}>Refresh</button>
      </div>
      <ErrorBanner message={err} />

      <table>
        <thead><tr><th>Assistance</th><th>Status</th><th>Customer</th><th>Driver</th><th>Location</th><th>Note</th></tr></thead>
        <tbody>
          {items.map(a => (
            <tr key={a.assistanceId}>
              <td><small className="muted">{a.assistanceId.slice(0,8)}…</small></td>
              <td><span className="badge">{a.status}</span></td>
              <td><small className="muted">{(a.customerUserId||"").slice(0,8)}…</small></td>
              <td><small className="muted">{a.driverUserId ? a.driverUserId.slice(0,8)+"…" : "-"}</small></td>
              <td><small className="muted">{a.lat}, {a.lng}</small></td>
              <td><small className="muted">{a.note || "-"}</small></td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={6}><small className="muted">No assistances.</small></td></tr>}
        </tbody>
      </table>
    </div>
  );
}
