import React, { useEffect, useState } from "react";
import Card from "@shared/ui/Card";
import Button from "@shared/ui/Button";
import Badge from "@shared/ui/Badge";
import ErrorBanner from "@shared/ui/ErrorBanner";
import Loader from "@shared/ui/Loader";
import ConfirmButton from "@shared/ui/ConfirmButton";
import { useToast } from "@shared/ui/Toast";
import { apiFetch } from "../../api";
import { keycloak, login } from "../../keycloak";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [app, setApp] = useState<any>(null);

  async function load() {
    setErr("");
    if (!keycloak.authenticated) return;
    try {
      const res = await apiFetch<any>("/v1/customer/driver/application", { method: "GET" });
      setApp(res);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function apply() {
    setLoading(true);
    setErr("");
    try {
      const res = await apiFetch<any>("/v1/customer/driver/apply", { method: "POST" });
      toast.push("Application submitted", "success");
      await load();
      return res;
    } catch (e:any) {
      setErr(e.message);
      toast.push(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  const roles: string[] = (keycloak.tokenParsed as any)?.realm_access?.roles || [];
  const isDriver = roles.includes("driver");
  const isPending = roles.includes("driver_pending") || app?.application?.status === "PENDING";

  if (!keycloak.authenticated) {
    return (
      <Card>
        <div className="h1">Welcome to Ziza</div>
        <p className="muted">Login to request rides and manage your profile.</p>
        <Button variant="primary" onClick={() => login()}>Login</Button>
      </Card>
    );
  }

  return (
    <div className="pageGrid">
      <Card>
        <div className="h1">Customer dashboard</div>
        <p className="muted">Quick actions</p>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginTop: 12 }}>
          <Link to="/estimate"><Button variant="primary">Request a ride</Button></Link>
          <Link to="/trips"><Button>My trips</Button></Link>
        </div>

        <div style={{ marginTop: 16 }}>
          <div className="h2">Your roles</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop: 8 }}>
            {roles.map(r => <Badge key={r}>{r}</Badge>)}
          </div>
        </div>
      </Card>

      <Card>
        <div className="h1">Become a driver</div>
        <p className="muted">
          Customers can apply to become drivers. An admin will review your application.
        </p>

        <ErrorBanner message={err} />

        {loading && <Loader label="Submitting…" />}

        <div style={{ marginTop: 12 }}>
          {isDriver ? (
            <>
              <Badge>driver</Badge>
              <p className="muted" style={{ marginTop: 10 }}>
                You already have the driver role. Open the Driver app to start taking trips.
              </p>
              <a href="http://localhost:3001" target="_blank" rel="noreferrer">
                <Button variant="primary">Open Driver app</Button>
              </a>
            </>
          ) : isPending ? (
            <>
              <Badge>driver_pending</Badge>
              <p className="muted" style={{ marginTop: 10 }}>
                Your application is pending approval. Once approved, log out/in (or refresh token) and open the Driver app.
              </p>
              <a href="http://localhost:3001" target="_blank" rel="noreferrer">
                <Button>Open Driver app</Button>
              </a>
            </>
          ) : (
            <>
              <ConfirmButton
                variant="primary"
                confirmText="Submit driver application?"
                onConfirm={apply}
                disabled={loading}
              >
                Apply now
              </ConfirmButton>
              <p className="muted" style={{ marginTop: 10 }}>
                After approval, you will receive the <b>driver</b> role.
              </p>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
