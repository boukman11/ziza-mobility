import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../api";
import { useToast } from "@shared/ui/Toast";
import ErrorBanner from "@shared/ui/ErrorBanner";
import { keycloak } from "../../keycloak";
import Card from "@shared/ui/Card";
import Button from "@shared/ui/Button";
import ConfirmButton from "@shared/ui/ConfirmButton";
import Badge from "@shared/ui/Badge";

export default function Outbox() {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [limit, setLimit] = useState("50");
  const [filterStatus, setFilterStatus] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setErr(""); setMsg("");
    if (!keycloak.authenticated) { setErr("Login required."); return; }
    try {
      const res = await apiFetch<any>("/v1/admin/email-outbox?limit=200&offset=0", { method: "GET" });
      setItems(res.items || []);
    } catch (e:any) { setErr(e.message); toast.push(e.message, "error"); }
  }

  async function processOnce() {
    setErr(""); setMsg(""); setBusy(true);
    try {
      await apiFetch<any>(`/v1/admin/email-outbox/process?limit=${encodeURIComponent(limit)}`, { method: "POST" });
      setMsg("Outbox processed.");
      toast.push("Outbox processed", "success");
      await load();
    } catch (e:any) { setErr(e.message); toast.push(e.message, "error"); }
    finally { setBusy(false); }
  }

  useEffect(() => { load(); }, []);

  const statusOptions = useMemo(() => Array.from(new Set(items.map((i:any) => String(i.status)))).sort(), [items]);
  const filtered = useMemo(() => items.filter((i:any) => !filterStatus || String(i.status) === filterStatus), [items, filterStatus]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of items) c[String(i.status)] = (c[String(i.status)] || 0) + 1;
    return c;
  }, [items]);

  return (
    <Card>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <div>
          <div style={{ fontWeight: 900 }}>Email outbox</div>
          <small className="muted">Inspect queue + process safely</small>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Status: all</option>
            {statusOptions.map(s => <option key={s} value={s}>{s} ({counts[s] || 0})</option>)}
          </select>
          <input value={limit} onChange={(e) => setLimit(e.target.value)} style={{ width: 120 }} />
          <ConfirmButton
            variant="primary"
            confirmText={`Process outbox now? (limit=${limit})`}
            onConfirm={processOnce}
            disabled={busy}
          >
            Process
          </ConfirmButton>
          <Button onClick={load} disabled={busy}>Refresh</Button>
        </div>
      </div>

      {msg && <p style={{ color:"green" }}>{msg}</p>}
      <ErrorBanner message={err} />

      <hr />
      <table>
        <thead><tr><th>Status</th><th>To</th><th>Subject</th><th>Created</th><th>Last error</th></tr></thead>
        <tbody>
          {filtered.map((e:any) => (
            <tr key={e.id}>
              <td><Badge>{e.status}</Badge></td>
              <td>{e.to_email}</td>
              <td><small className="muted">{e.subject}</small></td>
              <td><small className="muted">{new Date(e.created_at).toLocaleString()}</small></td>
              <td><small className="muted">{e.last_error || "-"}</small></td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan={5}><small className="muted">No outbox items.</small></td></tr>}
        </tbody>
      </table>
    </Card>
  );
}
