import React, { useEffect, useState } from "react";
import { apiFetch } from "../../api";
import { useToast } from "@shared/ui/Toast";
import ErrorBanner from "@shared/ui/ErrorBanner";
import { keycloak } from "../../keycloak";

export default function Notifications() {
  const [items, setItems] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const toast = useToast();

  async function load() {
    setErr("");
    if (!keycloak.authenticated) { setErr("Login required."); return; }
    try {
      const res = await apiFetch<any>("/v1/admin/notifications?limit=200&offset=0", { method: "GET" });
      setItems(res.items || []);
    } catch (e:any) { setErr(e.message);
      toast.push(e.message, "error"); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="card">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontWeight: 700 }}>Notifications</div>
        <button onClick={load}>Refresh</button>
      </div>
      <ErrorBanner message={err} />
      <table>
        <thead><tr><th>User</th><th>Type</th><th>Title</th><th>Read</th><th>When</th></tr></thead>
        <tbody>
          {items.map(n => (
            <tr key={n.id}>
              <td><small className="muted">{(n.userId||"").slice(0,8)}…</small></td>
              <td><span className="badge">{n.type}</span></td>
              <td>{n.title}</td>
              <td><span className="badge">{n.is_read ? "YES" : "NO"}</span></td>
              <td><small className="muted">{new Date(n.created_at).toLocaleString()}</small></td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={5}><small className="muted">No notifications.</small></td></tr>}
        </tbody>
      </table>
    </div>
  );
}
