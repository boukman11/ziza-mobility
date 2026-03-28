import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../api";
import { useToast } from "@shared/ui/Toast";
import ErrorBanner from "@shared/ui/ErrorBanner";
import { keycloak } from "../../keycloak";
import Card from "@shared/ui/Card";
import Button from "@shared/ui/Button";
import ConfirmButton from "@shared/ui/ConfirmButton";
import Badge from "@shared/ui/Badge";

export default function Drivers() {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    setErr(""); setMsg("");
    if (!keycloak.authenticated) { setErr("Login required."); return; }
    try {
      // Limit must be ≤ 200 to satisfy API validation (backend allows up to 200)
      const res = await apiFetch<any>("/v1/admin/drivers?limit=200&offset=0", { method: "GET" });
      setItems(res.items || []);
    } catch (e:any) { setErr(e.message); toast.push(e.message, "error"); }
  }

  async function suspend(id: string) {
    setErr(""); setMsg("");
    try {
      await apiFetch<any>(`/v1/admin/drivers/${id}/suspend`, { method: "POST" });
      setMsg("Driver suspended.");
      toast.push("Driver suspended", "success");
      await load();
    } catch (e:any) { setErr(e.message); toast.push(e.message, "error"); }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((d) => {
      if (onlyOnline && !d.is_online) return false;
      if (!needle) return true;
      return String(d.driverUserId || "").toLowerCase().includes(needle);
    });
  }, [items, q, onlyOnline]);

  return (
    <Card>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontWeight:800 }}>Drivers</div>
          <small className="muted">Search + quick filters</small>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search driver id…" style={{ width: 260 }} />
          <Button onClick={() => setOnlyOnline(v => !v)}>{onlyOnline ? "Only online: ON" : "Only online: OFF"}</Button>
          <Button onClick={load}>Refresh</Button>
        </div>
      </div>

      {msg && <p style={{ color:"green" }}>{msg}</p>}
      <ErrorBanner message={err} />

      <hr />
      <table>
        <thead><tr><th>Driver</th><th>Status</th><th>Online</th><th>Last location</th><th></th></tr></thead>
        <tbody>
          {filtered.map(d => (
            <tr key={d.driverUserId}>
              <td><small className="muted">{d.driverUserId}</small></td>
              <td><Badge>{d.status}</Badge></td>
              <td><Badge>{d.is_online ? "YES" : "NO"}</Badge></td>
              <td><small className="muted">{d.last_lat ?? "-"}, {d.last_lng ?? "-"}</small></td>
              <td><ConfirmButton confirmText={`Suspend driver ${d.driverUserId}?`} onConfirm={() => suspend(d.driverUserId)}>
                Suspend
              </ConfirmButton></td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan={5}><small className="muted">No drivers.</small></td></tr>}
        </tbody>
      </table>
    </Card>
  );
}
