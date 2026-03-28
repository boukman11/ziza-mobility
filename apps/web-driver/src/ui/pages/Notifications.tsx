import React, { useEffect, useState } from "react";
import { apiFetch } from "../../api";
import { useToast } from "@shared/ui/Toast";
import ErrorBanner from "@shared/ui/ErrorBanner";
import { keycloak } from "../../keycloak";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string;
  meta: any;
  is_read: boolean;
  created_at: string;
};

export default function Notifications() {
  const [items, setItems] = useState<Notif[]>([]);
  const [err, setErr] = useState("");
  const toast = useToast();

  async function load() {
    setErr("");
    if (!keycloak.authenticated) { setErr("Login required."); return; }
    try {
      const res = await apiFetch<any>("/v1/driver/notifications?limit=50&offset=0", { method: "GET" });
      setItems(res.items || []);
    } catch (e:any) { setErr(e.message);
      toast.push(e.message, "error"); }
  }

  async function markRead(id: string) {
    try {
      await apiFetch<any>(`/v1/driver/notifications/${id}/read`, { method: "POST" });
      await load();
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

      {err && <p style={{ color:"crimson" }}>{err}</p>}

      <table>
        <thead><tr><th>Status</th><th>Title</th><th>When</th><th></th></tr></thead>
        <tbody>
          {items.map(n => (
            <tr key={n.id}>
              <td><span className="badge">{n.is_read ? "READ" : "NEW"}</span></td>
              <td>
                <div style={{ fontWeight: 600 }}>{n.title}</div>
                <small className="muted">{n.body}</small>
              </td>
              <td><small className="muted">{new Date(n.created_at).toLocaleString()}</small></td>
              <td>{!n.is_read && <button onClick={() => markRead(n.id)}>Mark read</button>}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={4}><small className="muted">No notifications.</small></td></tr>}
        </tbody>
      </table>
    </div>
  );
}
