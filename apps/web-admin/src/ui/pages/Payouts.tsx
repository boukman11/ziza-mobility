import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../api";
import { useToast } from "@shared/ui/Toast";
import ErrorBanner from "@shared/ui/ErrorBanner";
import { keycloak } from "../../keycloak";
import Card from "@shared/ui/Card";
import Button from "@shared/ui/Button";
import ConfirmButton from "@shared/ui/ConfirmButton";
import Badge from "@shared/ui/Badge";

export default function Payouts() {
  const toast = useToast();
  const [days, setDays] = useState("7");
  const [items, setItems] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setErr(""); setMsg("");
    if (!keycloak.authenticated) { setErr("Login required."); return; }
    try {
      const res = await apiFetch<any>("/v1/admin/payouts?limit=200&offset=0", { method: "GET" });
      setItems(res.items || []);
    } catch (e:any) { setErr(e.message); toast.push(e.message, "error"); }
  }

  async function runSync() {
    setErr(""); setMsg(""); setBusy(true);
    try {
      await apiFetch<any>("/v1/admin/payouts/run", { method: "POST", body: JSON.stringify({ days: Number(days) }) });
      setMsg("Payout run executed (sync).");
      toast.push("Payout run executed", "success");
      await load();
    } catch (e:any) { setErr(e.message); toast.push(e.message, "error"); }
    finally { setBusy(false); }
  }

  async function runAsync() {
    setErr(""); setMsg(""); setBusy(true);
    try {
      await apiFetch<any>("/v1/admin/payouts/run-async", { method: "POST", body: JSON.stringify({ days: Number(days) }) });
      setMsg("Payout job enqueued (async).");
      toast.push("Payout job enqueued", "success");
    } catch (e:any) { setErr(e.message); toast.push(e.message, "error"); }
    finally { setBusy(false); }
  }

  useEffect(() => { load(); }, []);

  const statusOptions = useMemo(() => Array.from(new Set(items.map((i:any) => String(i.status)))).sort(), [items]);
  const filtered = useMemo(() => items.filter((p:any) => !filterStatus || String(p.status) === filterStatus), [items, filterStatus]);

  return (
    <Card>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <div>
          <div style={{ fontWeight: 900 }}>Payouts</div>
          <small className="muted">Run payouts with confirmation</small>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Status: all</option>
            {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input value={days} onChange={(e) => setDays(e.target.value)} style={{ width: 120 }} />
          <ConfirmButton
            variant="primary"
            confirmText={`Run payouts SYNC for last ${days} days?`}
            onConfirm={runSync}
            disabled={busy}
          >
            Run
          </ConfirmButton>
          <ConfirmButton
            confirmText={`Enqueue payouts ASYNC for last ${days} days?`}
            onConfirm={runAsync}
            disabled={busy}
          >
            Run async
          </ConfirmButton>
          <Button onClick={load} disabled={busy}>Refresh</Button>
        </div>
      </div>

      {msg && <p style={{ color:"green" }}>{msg}</p>}
      <ErrorBanner message={err} />

      <hr />
      <table>
        <thead><tr><th>Status</th><th>Driver</th><th>Amount</th><th>When</th><th>Note</th></tr></thead>
        <tbody>
          {filtered.map((p:any) => (
            <tr key={p.id}>
              <td><Badge>{p.status}</Badge></td>
              <td><small className="muted">{(p.driver_user_id||"").slice(0,8)}…</small></td>
              <td>{p.currency} {p.amount}</td>
              <td><small className="muted">{new Date(p.created_at).toLocaleString()}</small></td>
              <td><small className="muted">{p.note || "-"}</small></td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan={5}><small className="muted">No payouts.</small></td></tr>}
        </tbody>
      </table>
    </Card>
  );
}
