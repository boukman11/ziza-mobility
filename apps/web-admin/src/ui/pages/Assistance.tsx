import React, { useEffect, useState } from "react";
import Card from "@shared/ui/Card";
import Button from "@shared/ui/Button";
import ConfirmButton from "@shared/ui/ConfirmButton";
import Badge from "@shared/ui/Badge";
import ErrorBanner from "@shared/ui/ErrorBanner";
import Loader from "@shared/ui/Loader";
import { useToast } from "@shared/ui/Toast";
import { apiFetch } from "../../api";
import { keycloak } from "../../keycloak";

export default function AdminAssistance() {
  const toast = useToast();
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    if (!keycloak.authenticated) return;
    setBusy(true);
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}&limit=200&offset=0` : "?limit=200&offset=0";
      const res = await apiFetch<any>(`/v1/admin/assistance${qs}`, { method: "GET" });
      setItems(res.items || []);
    } catch (e:any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, [status]);

  async function close(id: string) {
    setErr("");
    try {
      await apiFetch(`/v1/admin/assistance/${id}/close`, { method: "POST" });
      toast.push("Closed", "success");
      await load();
    } catch (e:any) {
      setErr(e.message);
      toast.push(e.message, "error");
    }
  }

  if (!keycloak.authenticated) {
    return (
      <Card>
        <div className="h1">Login required</div>
        <p className="muted">Please login from the top bar.</p>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        <div>
          <div className="h1">Assistance</div>
          <small className="muted">Monitor and close requests (MVP).</small>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="REQUESTED">REQUESTED</option>
            <option value="ASSIGNED">ASSIGNED</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELED">CANCELED</option>
          </select>
          <Button onClick={load} disabled={busy}>Refresh</Button>
        </div>
      </div>

      <ErrorBanner message={err} />
      {busy && <Loader label="Loading…" />}

      <hr />
      <table className="table">
        <thead><tr><th>Status</th><th>Note</th><th>Location</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>
          {items.map((x:any) => (
            <tr key={x.id}>
              <td><Badge>{x.status}</Badge></td>
              <td>{x.note || "-"}</td>
              <td><small className="muted">{Number(x.lat).toFixed(4)}, {Number(x.lng).toFixed(4)}</small></td>
              <td><small className="muted">{new Date(x.created_at).toLocaleString()}</small></td>
              <td>
                <ConfirmButton confirmText="Close this request?" onConfirm={() => close(x.id)}>
                  Close
                </ConfirmButton>
              </td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={5}><small className="muted">No requests.</small></td></tr>}
        </tbody>
      </table>
    </Card>
  );
}
