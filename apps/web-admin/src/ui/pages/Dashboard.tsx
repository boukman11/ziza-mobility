import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../api";
import { useToast } from "@shared/ui/Toast";
import ErrorBanner from "@shared/ui/ErrorBanner";
import { keycloak } from "../../keycloak";
import Card from "@shared/ui/Card";
import Button from "@shared/ui/Button";
import ConfirmButton from "@shared/ui/ConfirmButton";
import Badge from "@shared/ui/Badge";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const toast = useToast();

  const [health, setHealth] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    setErr(""); setMsg("");
    try { setHealth(await apiFetch<any>("/health", { method: "GET" })); }
    catch (e:any) { setErr(e.message); toast.push(e.message, "error"); }

    if (keycloak.authenticated) {
      try { setMe(await apiFetch<any>("/v1/admin/me", { method: "GET" })); }
      catch (e:any) { setErr(e.message); toast.push(e.message, "error"); }
      try { setMetrics(await apiFetch<any>("/v1/admin/metrics", { method: "GET" })); }
      catch (e:any) { setErr(e.message); toast.push(e.message, "error"); }
    }
  }

  async function seedScenario() {
    setErr(""); setMsg("");
    try {
      await apiFetch<any>("/v1/admin/dev/seed-scenario", { method: "POST" });
      setMsg("Seed scenario created (3 trips).");
      toast.push("Seed scenario created", "success");
      await load();
    } catch (e:any) { setErr(e.message); toast.push(e.message, "error"); }
  }

  useEffect(() => { load(); }, []);

  const cards = useMemo(() => {
    const m = metrics || {};
    const get = (k: string) => (m[k] ?? m[k.toUpperCase()] ?? m[k.toLowerCase()]);
    return [
      { label: "Trips (total)", value: get("trips_total") ?? get("trips") ?? "-" },
      { label: "Active trips", value: get("trips_active") ?? get("active_trips") ?? "-" },
      { label: "Drivers", value: get("drivers_total") ?? get("drivers") ?? "-" },
      { label: "Revenue", value: get("revenue_total") ?? get("revenue") ?? "-" },
    ];
  }, [metrics]);

  return (
    <div className="grid3">
      <Card>
        <div style={{ fontWeight: 800 }}>Quick actions</div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginTop: 10 }}>
          <ConfirmButton variant="primary" confirmText="Seed scenario? This will create demo data." onConfirm={seedScenario}>Seed scenario</ConfirmButton>
          <Button onClick={load}>Refresh</Button>
          <Link to="/trips"><Button>Trips</Button></Link>
          <Link to="/drivers"><Button>Drivers</Button></Link>
          <Link to="/jobs"><Button>Jobs</Button></Link>
        </div>
        {msg && <p style={{ color: "green" }}>{msg}</p>}
        <ErrorBanner message={err} />
        <hr />
        <small className="muted">Keycloak: http://localhost:8080 • Swagger: http://localhost:8000/docs</small>
      </Card>

      <Card>
        <div style={{ fontWeight: 800, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span>Metrics</span>
          <Badge>{health?.status || "health?"}</Badge>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          {cards.map(c => (
            <div key={c.label} className="card" style={{ border: "1px solid #eee" }}>
              <div style={{ fontWeight: 700 }}>{c.label}</div>
              <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{String(c.value)}</div>
            </div>
          ))}
        </div>

        <hr />
        <div style={{ fontWeight: 700 }}>Me</div>
        <pre style={{ whiteSpace:"pre-wrap", marginBottom:0 }}>{JSON.stringify(me, null, 2)}</pre>

        <hr />
        <div style={{ fontWeight: 700 }}>Raw metrics</div>
        <pre style={{ whiteSpace:"pre-wrap", marginBottom:0 }}>{JSON.stringify(metrics, null, 2)}</pre>
      </Card>
    </div>
  );
}
