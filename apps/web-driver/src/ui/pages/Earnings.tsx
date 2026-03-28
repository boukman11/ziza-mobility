import React, { useEffect, useState } from "react";
import Card from "@shared/ui/Card";
import Badge from "@shared/ui/Badge";
import Button from "@shared/ui/Button";
import ErrorBanner from "@shared/ui/ErrorBanner";
import Loader from "@shared/ui/Loader";
import { useToast } from "@shared/ui/Toast";
import { apiFetch } from "../../api";
import { keycloak } from "../../keycloak";

function money(cents: number) {
  const v = (cents || 0) / 100;
  return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function Earnings() {
  const toast = useToast();
  const [days, setDays] = useState("7");
  const [summary, setSummary] = useState<any>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    if (!keycloak.authenticated) return;
    setBusy(true);
    try {
      const s = await apiFetch<any>(`/v1/driver/earnings/summary?days=${encodeURIComponent(days)}`, { method: "GET" });
      setSummary(s);
      const p = await apiFetch<any>("/v1/driver/payouts?limit=50&offset=0", { method: "GET" });
      setPayouts(p.items || []);
    } catch (e:any) {
      setErr(e.message);
      toast.push(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, [days]);

  if (!keycloak.authenticated) {
    return (
      <Card>
        <div className="h1">Login required</div>
        <p className="muted">Please login from the top bar.</p>
      </Card>
    );
  }

  return (
    <div className="pageGrid">
      <Card>
        <div className="h1">Earnings</div>
        <small className="muted">Summary for the last N days + payouts history.</small>

        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", marginTop: 12 }}>
          <select value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
          </select>
          <Button onClick={load} disabled={busy}>Refresh</Button>
        </div>

        <ErrorBanner message={err} />
        {busy && <Loader label="Loading…" />}

        {summary && (
          <div className="grid3" style={{ marginTop: 14 }}>
            <Card style={{ padding: "14px" }}>
              <small className="muted">Trips</small>
              <div style={{ fontWeight: 950, fontSize: 22 }}>{summary.trip_count}</div>
            </Card>
            <Card style={{ padding: "14px" }}>
              <small className="muted">Total</small>
              <div style={{ fontWeight: 950, fontSize: 22 }}>{money(summary.total_cents)}</div>
            </Card>
            <Card style={{ padding: "14px" }}>
              <small className="muted">Period</small>
              <div style={{ fontWeight: 950, fontSize: 22 }}>{summary.days}d</div>
            </Card>
          </div>
        )}
      </Card>

      <Card>
        <div className="h1">Payouts</div>
        <small className="muted">Latest payouts (MVP).</small>

        <table className="table" style={{ marginTop: 12 }}>
          <thead><tr><th>Status</th><th>Amount</th><th>Created</th><th>Note</th></tr></thead>
          <tbody>
            {payouts.map((p:any) => (
              <tr key={p.id}>
                <td><Badge>{p.status}</Badge></td>
                <td>{p.currency} {(p.amount || 0).toFixed ? p.amount.toFixed(2) : p.amount}</td>
                <td><small className="muted">{new Date(p.created_at).toLocaleString()}</small></td>
                <td><small className="muted">{p.note || "-"}</small></td>
              </tr>
            ))}
            {payouts.length === 0 && <tr><td colSpan={4}><small className="muted">No payouts yet.</small></td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
