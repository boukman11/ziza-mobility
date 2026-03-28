import React, { useEffect, useState } from "react";
import { apiFetch } from "../../api";
import { useToast } from "@shared/ui/Toast";
import ErrorBanner from "@shared/ui/ErrorBanner";
import { keycloak } from "../../keycloak";
import JsonBlock from "../components/JsonBlock";

export default function Pricing() {
  const [active, setActive] = useState<any>(null);
  const [err, setErr] = useState("");
  const toast = useToast();

  async function load() {
    setErr("");
    if (!keycloak.authenticated) { setErr("Login required."); return; }
    try {
      setActive(await apiFetch<any>("/v1/admin/pricing/active", { method: "GET" }));
    } catch (e:any) { setErr(e.message);
      toast.push(e.message, "error"); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="card">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontWeight: 700 }}>Active pricing</div>
        <button onClick={load}>Refresh</button>
      </div>
      <ErrorBanner message={err} />
      <hr />
      <JsonBlock value={active} />
    </div>
  );
}
