import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../api";
import { useToast } from "@shared/ui/Toast";
import ErrorBanner from "@shared/ui/ErrorBanner";
import { keycloak } from "../../keycloak";
import Card from "@shared/ui/Card";
import Button from "@shared/ui/Button";
import ConfirmButton from "@shared/ui/ConfirmButton";
import Badge from "@shared/ui/Badge";

export default function Users() {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    if (!keycloak.authenticated) { setErr("Login required."); return; }
    try {
      // Limit must be ≤ 200 to satisfy API validation (backend allows up to 200)
      const res = await apiFetch<any>("/v1/admin/users?limit=200&offset=0", { method: "GET" });
      setItems(res.items || []);
    } catch (e:any) { setErr(e.message); toast.push(e.message, "error"); }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((u) => String(u.email || "").toLowerCase().includes(needle));
  }, [items, q]);

  return (
    <Card>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
        <div>
          <div className="h1">Users</div>
          <small className="muted">
            Roles are stored in Keycloak (realm roles). Use actions to promote customer → driver.
          </small>
          <div style={{ marginTop: 8 }}><Badge>Dangerous actions are rate-limited</Badge></div>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search email…" style={{ width: 260 }} />
          <Button onClick={load}>Refresh</Button>
        </div>
      </div>

      <ErrorBanner message={err} />

      <hr />
      <table className="table">
        <thead><tr><th>Email</th><th>Roles</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>
          {filtered.map((u:any) => {
            const roles: string[] = u.roles || [];
            const hasDriver = roles.includes("driver");
            const isAdmin = roles.includes("admin");
            return (
              <tr key={u.id}>
                <td>{u.email || <small className="muted">-</small>}</td>
                <td>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {roles.length ? roles.map((r:string) => <Badge key={r}>{r}</Badge>) : <small className="muted">-</small>}
                  </div>
                </td>
                <td><small className="muted">{u.created_at ? new Date(u.created_at).toLocaleString() : "-"}</small></td>
                <td>
                  <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                    {!hasDriver && (
                      <ConfirmButton
                        variant="primary"
                        confirmText={`Grant driver role to ${u.email}?`}
                        onConfirm={async () => {
                          await apiFetch(`/v1/admin/iam/users/${u.oidc_sub}/roles/add?role=driver`, { method: "POST" });
                          toast.push("Driver role granted", "success");
                          await load();
                        }}
                        disabled={!u.oidc_sub || isAdmin}
                      >
                        Grant driver
                      </ConfirmButton>
                    )}
                    {hasDriver && (
                      <ConfirmButton
                        confirmText={`Remove driver role from ${u.email}?`}
                        onConfirm={async () => {
                          await apiFetch(`/v1/admin/iam/users/${u.oidc_sub}/roles/remove?role=driver`, { method: "POST" });
                          toast.push("Driver role removed", "success");
                          await load();
                        }}
                        disabled={!u.oidc_sub || isAdmin}
                      >
                        Remove driver
                      </ConfirmButton>
                    )}
                    {!u.oidc_sub && <small className="muted">No OIDC sub</small>}
                    {isAdmin && <small className="muted">Admin protected</small>}
                  </div>
                </td>
              </tr>
            );
          })}
          {filtered.length === 0 && <tr><td colSpan={4}><small className="muted">No users.</small></td></tr>}
        </tbody>
      </table>
    </Card>
  );
}
