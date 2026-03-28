import React, { useEffect, useMemo, useState } from "react";
import Card from "@shared/ui/Card";
import Button from "@shared/ui/Button";
import ConfirmButton from "@shared/ui/ConfirmButton";
import Badge from "@shared/ui/Badge";
import ErrorBanner from "@shared/ui/ErrorBanner";
import { useToast } from "@shared/ui/Toast";
import { apiFetch } from "../../api";
import { keycloak } from "../../keycloak";

export default function DriverOnboarding() {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState("PENDING");
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    if (!keycloak.authenticated) { setErr("Login required."); return; }
    try {
      const res = await apiFetch<any>(`/v1/admin/driver-applications?status=${encodeURIComponent(status)}&limit=200&offset=0`, { method: "GET" });
      setItems(res.items || []);
    } catch (e:any) { setErr(e.message); toast.push(e.message, "error"); }
  }

  useEffect(() => { load(); }, [status]);

  const filtered = useMemo(() => items, [items]);

  return (
    <Card>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        <div>
          <div className="h1">Driver onboarding</div>
          <small className="muted">Approve or reject customer driver applications.</small>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="PENDING">PENDING</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
          <Button onClick={load}>Refresh</Button>
        </div>
      </div>

      <ErrorBanner message={err} />

      <hr />
      <table className="table">
        <thead><tr><th>Email</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>
          {filtered.map((a:any) => (
            <tr key={a.id}>
              <td>{a.email}</td>
              <td><Badge>{a.status}</Badge></td>
              <td><small className="muted">{new Date(a.created_at).toLocaleString()}</small></td>
              <td>
                <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                  {a.status === "PENDING" && (
                    <>
                      <ConfirmButton
                        variant="primary"
                        confirmText={`Approve ${a.email} as driver?`}
                        onConfirm={async () => {
                          await apiFetch(`/v1/admin/driver-applications/${a.id}/approve`, { method: "POST" });
                          toast.push("Approved", "success");
                          await load();
                        }}
                      >
                        Approve
                      </ConfirmButton>
                      <ConfirmButton
                        confirmText={`Reject ${a.email}?`}
                        onConfirm={async () => {
                          await apiFetch(`/v1/admin/driver-applications/${a.id}/reject?note=rejected`, { method: "POST" });
                          toast.push("Rejected", "success");
                          await load();
                        }}
                      >
                        Reject
                      </ConfirmButton>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan={4}><small className="muted">No applications.</small></td></tr>}
        </tbody>
      </table>
    </Card>
  );
}
