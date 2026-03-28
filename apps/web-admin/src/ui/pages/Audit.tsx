import React, { useEffect, useState } from "react";
import { apiFetch } from "../../api";
import { useToast } from "@shared/ui/Toast";
import ErrorBanner from "@shared/ui/ErrorBanner";
import { keycloak } from "../../keycloak";

export default function Audit() {
  const [items, setItems] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const toast = useToast();

  async function load() {
    setErr("");
    if (!keycloak.authenticated) { setErr("Login required."); return; }
    try {
      const res = await apiFetch<any>("/v1/admin/audit-logs?limit=200&offset=0", { method: "GET" });
      setItems(res.items || []);
    } catch (e:any) { setErr(e.message);
      toast.push(e.message, "error"); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="card">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontWeight: 700 }}>Audit logs</div>
        <button onClick={load}>Refresh</button>
      </div>
      <ErrorBanner message={err} />

      <table>
        <thead><tr><th>Action</th><th>Entity</th><th>EntityId</th><th>Actor</th><th>When</th></tr></thead>
        <tbody>
          {items.map(a => (
            <tr key={a.id}>
              <td><span className="badge">{a.action}</span></td>
              <td><small className="muted">{a.entity_type}</small></td>
              <td><small className="muted">{a.entity_id}</small></td>
              <td><small className="muted">{(a.actor_user_id||"").slice(0,8)}…</small></td>
              <td><small className="muted">{new Date(a.created_at).toLocaleString()}</small></td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={5}><small className="muted">No audit logs.</small></td></tr>}
        </tbody>
      </table>
    </div>
  );
}
