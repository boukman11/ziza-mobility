import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../api";
import { useToast } from "@shared/ui/Toast";
import ErrorBanner from "@shared/ui/ErrorBanner";
import { keycloak } from "../../keycloak";
import Card from "@shared/ui/Card";
import Button from "@shared/ui/Button";
import ConfirmButton from "@shared/ui/ConfirmButton";
import Badge from "@shared/ui/Badge";

type JobRow = any;

const TEMPLATES: Record<string, any> = {
  EMAIL_OUTBOX: { limit: 50 },
  PAYOUTS: { days: 7 },
};

export default function Jobs() {
  const toast = useToast();

  const [items, setItems] = useState<JobRow[]>([]);
  const [jobType, setJobType] = useState<keyof typeof TEMPLATES>("EMAIL_OUTBOX");
  const [payloadText, setPayloadText] = useState(JSON.stringify(TEMPLATES.EMAIL_OUTBOX, null, 2));
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setErr(""); setMsg("");
    if (!keycloak.authenticated) { setErr("Login required."); return; }
    try {
      const res = await apiFetch<any>("/v1/admin/jobs?limit=200&offset=0", { method: "GET" });
      setItems(res.items || []);
    } catch (e:any) { setErr(e.message); toast.push(e.message, "error"); }
  }

  function setTemplate(t: keyof typeof TEMPLATES) {
    setJobType(t);
    setPayloadText(JSON.stringify(TEMPLATES[t], null, 2));
  }

  function parsePayload(): any | null {
    try {
      const obj = JSON.parse(payloadText);
      return obj;
    } catch (e:any) {
      setErr("Payload must be valid JSON.");
      toast.push("Payload must be valid JSON.", "error");
      return null;
    }
  }

  async function runJob() {
    setErr(""); setMsg(""); setBusy(true);
    const obj = parsePayload();
    if (!obj) { setBusy(false); return; }

    // API expects query param payload as JSON string
    const qs = new URLSearchParams({
      job_type: String(jobType),
      payload: JSON.stringify(obj),
    });

    try {
      await apiFetch<any>(`/v1/admin/jobs/run?${qs.toString()}`, { method: "POST" });
      setMsg("Job enqueued.");
      toast.push("Job enqueued", "success");
      await load();
    } catch (e:any) { setErr(e.message); toast.push(e.message, "error"); }
    finally { setBusy(false); }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return items.filter((j:any) => {
      if (filterStatus && String(j.status) !== filterStatus) return false;
      if (filterType && String(j.type) !== filterType) return false;
      return true;
    });
  }, [items, filterStatus, filterType]);

  const statusOptions = useMemo(() => Array.from(new Set(items.map((i:any) => String(i.status)))).sort(), [items]);
  const typeOptions = useMemo(() => Array.from(new Set(items.map((i:any) => String(i.type)))).sort(), [items]);

  return (
    <Card>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <div>
          <div style={{ fontWeight: 900 }}>Jobs</div>
          <small className="muted">Create jobs safely + filter history</small>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">Type: all</option>
            {typeOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Status: all</option>
            {statusOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <Button onClick={load} disabled={busy}>Refresh</Button>
        </div>
      </div>

      <hr />

      <div className="row" style={{ alignItems:"flex-start" }}>
        <div className="card" style={{ border:"1px solid #eee" }}>
          <div style={{ fontWeight: 800 }}>Create job</div>
          <small className="muted">Templates help avoid JSON mistakes.</small>

          <div style={{ marginTop: 10, display:"flex", gap:10, flexWrap:"wrap" }}>
            <Button onClick={() => setTemplate("EMAIL_OUTBOX")}>Template: EMAIL_OUTBOX</Button>
            <Button onClick={() => setTemplate("PAYOUTS")}>Template: PAYOUTS</Button>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700 }}>Type</div>
            <select value={jobType} onChange={(e) => setTemplate(e.target.value as any)} style={{ width: "100%" }}>
              <option value="EMAIL_OUTBOX">EMAIL_OUTBOX</option>
              <option value="PAYOUTS">PAYOUTS</option>
            </select>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700 }}>Payload (JSON)</div>
            <textarea value={payloadText} onChange={(e) => setPayloadText(e.target.value)} rows={8} style={{ width:"100%" }} />
          </div>

          <div style={{ marginTop: 10, display:"flex", gap:10, flexWrap:"wrap" }}>
            <ConfirmButton
              variant="primary"
              confirmText={`Create job ${jobType}?`}
              onConfirm={runJob}
              disabled={busy}
            >
              Create
            </ConfirmButton>
            <Button onClick={() => setPayloadText(JSON.stringify(parsePayload() ?? TEMPLATES[jobType], null, 2))} disabled={busy}>
              Format JSON
            </Button>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          {msg && <p style={{ color:"green" }}>{msg}</p>}
          <ErrorBanner message={err} />

          <table>
            <thead><tr><th>Type</th><th>Status</th><th>Attempts</th><th>Run after</th><th>Last error</th></tr></thead>
            <tbody>
              {filtered.map((j:any) => (
                <tr key={j.id}>
                  <td><Badge>{j.type}</Badge></td>
                  <td><Badge>{j.status}</Badge></td>
                  <td>{j.attempts}</td>
                  <td><small className="muted">{new Date(j.run_after).toLocaleString()}</small></td>
                  <td><small className="muted">{j.last_error || "-"}</small></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5}><small className="muted">No jobs.</small></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
