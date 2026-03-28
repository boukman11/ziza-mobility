import React, { useEffect, useState } from "react";
import Card from "@shared/ui/Card";
import Button from "@shared/ui/Button";
import Badge from "@shared/ui/Badge";
import ErrorBanner from "@shared/ui/ErrorBanner";
import Loader from "@shared/ui/Loader";
import { useToast } from "@shared/ui/Toast";
import { apiFetch } from "../../api";
import { keycloak } from "../../keycloak";

function okBadge(ok: boolean) {
  return <Badge>{ok ? "OK" : "FAIL"}</Badge>;
}

export default function SystemStatus() {
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    if (!keycloak.authenticated) return;
    setBusy(true);
    try {
      const res = await apiFetch<any>("/v1/admin/system/status", { method: "GET" });
      setData(res);
    } catch (e:any) {
      setErr(e.message);
      toast.push(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, []);

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
        <div className="h1">System status</div>
        <small className="muted">Quick diagnostics for DB + Keycloak + key counts.</small>

        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginTop: 12 }}>
          <Button onClick={load} disabled={busy}>Refresh</Button>
          {busy && <Badge>loading…</Badge>}
        </div>

        <ErrorBanner message={err} />
        {busy && <Loader label="Loading…" />}

        {data && (
          <>
            <hr />
            <div className="kv"><span className="muted">Overall</span><span style={{ display:"flex", gap:8, alignItems:"center" }}>{okBadge(!!data.ok)} <small className="muted">{data.time_utc}</small></span></div>
            <div className="kv"><span className="muted">Database</span><span style={{ display:"flex", gap:8, alignItems:"center" }}>{okBadge(!!data.db?.ok)} <small className="muted">{data.db?.error || ""}</small></span></div>
            <div className="kv"><span className="muted">Keycloak</span><span style={{ display:"flex", gap:8, alignItems:"center" }}>{okBadge(!!data.keycloak?.ok)} <small className="muted">{data.keycloak?.error || ""}</small></span></div>
          </>
        )}
      </Card>

      <Card>
        <div className="h1">Counts</div>
        <small className="muted">High-level totals (MVP).</small>
        {data?.counts ? (
          <table className="table" style={{ marginTop: 12 }}>
            <thead><tr><th>Entity</th><th>Total</th></tr></thead>
            <tbody>
              {Object.entries(data.counts).map(([k,v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td><b>{String(v)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <small className="muted">No data.</small>
        )}
      </Card>
    </div>
  );
}
