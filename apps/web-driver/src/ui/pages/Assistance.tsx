import React, { useEffect, useState } from "react";
import Card from "@shared/ui/Card";
import Button from "@shared/ui/Button";
import ConfirmButton from "@shared/ui/ConfirmButton";
import Badge from "@shared/ui/Badge";
import ErrorBanner from "@shared/ui/ErrorBanner";
import Loader from "@shared/ui/Loader";
import MapPreview from "@shared/ui/MapPreview";
import { useToast } from "@shared/ui/Toast";
import { apiFetch } from "../../api";
import { keycloak } from "../../keycloak";

export default function AssistanceDriver() {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    if (!keycloak.authenticated) return;
    setBusy(true);
    try {
      const res = await apiFetch<any>("/v1/driver/assistance/available?limit=50", { method: "GET" });
      setItems(res.items || []);
    } catch (e:any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function accept(id: string) {
    setErr("");
    try {
      await apiFetch(`/v1/driver/assistance/${id}/accept`, { method: "POST" });
      toast.push("Assistance accepted", "success");
      await load();
    } catch (e:any) {
      setErr(e.message);
      toast.push(e.message, "error");
    }
  }

  async function complete(id: string) {
    setErr("");
    try {
      await apiFetch(`/v1/driver/assistance/${id}/complete`, { method: "POST" });
      toast.push("Assistance completed", "success");
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
    <div className="pageGrid">
      <Card>
        <div className="h1">Assistance</div>
        <small className="muted">Available requests (MVP).</small>

        <ErrorBanner message={err} />
        {busy && <Loader label="Loading…" />}

        <table className="table" style={{ marginTop: 12 }}>
          <thead><tr><th>Status</th><th>Note</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map((x:any) => (
              <tr key={x.id}>
                <td><Badge>{x.status}</Badge></td>
                <td>{x.note || "-"}</td>
                <td><small className="muted">{new Date(x.created_at).toLocaleString()}</small></td>
                <td style={{ whiteSpace:"nowrap" }}>
                  <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                    <ConfirmButton variant="primary" confirmText="Accept this assistance?" onConfirm={() => accept(x.id)}>
                      Accept
                    </ConfirmButton>
                    <ConfirmButton confirmText="Mark completed?" onConfirm={() => complete(x.id)}>
                      Complete
                    </ConfirmButton>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={4}><small className="muted">No available requests.</small></td></tr>}
          </tbody>
        </table>
      </Card>

      <Card>
        <div className="h1">Map preview</div>
        <small className="muted">Preview of the first request location.</small>
        {items[0] ? (
          <MapPreview pickup={{ lat: items[0].lat, lng: items[0].lng }} title="Assistance location" />
        ) : (
          <small className="muted">No request.</small>
        )}
      </Card>
    </div>
  );
}
