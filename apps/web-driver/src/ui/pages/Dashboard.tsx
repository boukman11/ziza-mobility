import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../../api";
import { keycloak } from "../../keycloak";
import { useToast } from "@shared/ui/Toast";
import ErrorBanner from "@shared/ui/ErrorBanner";
import Loader from "@shared/ui/Loader";
import Card from "@shared/ui/Card";
import Button from "@shared/ui/Button";
import Badge from "@shared/ui/Badge";

export default function Dashboard() {
  const toast = useToast();

  const [health, setHealth] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [lat, setLat] = useState("40.7357");
  const [lng, setLng] = useState("-74.1724");
  const [autoLoc, setAutoLoc] = useState(false);

  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const timerRef = useRef<number | null>(null);

  const loc = useMemo(() => ({ lat: Number(lat), lng: Number(lng) }), [lat, lng]);

  async function load() {
    setErr(""); setMsg("");
    try {
      setHealth(await apiFetch<any>("/health", { method: "GET" }));
    } catch (e: any) {
      setErr(e.message);
      toast.push(e.message, "error");
    }
    if (keycloak.authenticated) {
      try { setMe(await apiFetch<any>("/v1/driver/me", { method: "GET" })); }
      catch (e: any) { setErr(e.message); toast.push(e.message, "error"); }
    }
  }

  async function setOnline(v: boolean) {
    setErr(""); setMsg(""); setBusy(true);
    try {
      await apiFetch<any>(v ? "/v1/driver/status/online" : "/v1/driver/status/offline", { method: "POST" });
      setMsg(v ? "Driver is ONLINE" : "Driver is OFFLINE");
      toast.push(v ? "You are ONLINE" : "You are OFFLINE", "success");
      await load();
    } catch (e: any) { setErr(e.message); toast.push(e.message, "error"); }
    finally { setBusy(false); }
  }

  async function updateLocationOnce(payload: {lat:number; lng:number}) {
    await apiFetch<any>("/v1/driver/location", { method: "PATCH", body: JSON.stringify(payload) });
  }

  async function updateLocation() {
    setErr(""); setMsg("");
    try {
      await updateLocationOnce(loc);
      setMsg("Location updated");
    } catch (e: any) { setErr(e.message); toast.push(e.message, "error"); }
  }

  function useSample() {
    setLat("40.7357");
    setLng("-74.1724");
    toast.push("Sample location loaded", "info");
  }

  function jitter(currentLat: number, currentLng: number) {
    const j1 = (Math.random() - 0.5) * 0.01;
    const j2 = (Math.random() - 0.5) * 0.01;
    return { lat: Number((currentLat + j1).toFixed(6)), lng: Number((currentLng + j2).toFixed(6)) };
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!autoLoc) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    if (!keycloak.authenticated) {
      toast.push("Login required to send location", "info");
      setAutoLoc(false);
      return;
    }
    // immediate send
    updateLocation().catch(() => {});
    timerRef.current = window.setInterval(() => {
      const next = jitter(Number(lat), Number(lng));
      setLat(String(next.lat));
      setLng(String(next.lng));
      updateLocationOnce(next).catch(() => {});
    }, 5000);
    toast.push("Auto location: ON", "success");
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoc]); // keep timer stable

  return (
    <div className="row">
      <Card>
        <div style={{ fontWeight: 800 }}>API Health</div>
        <pre style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(health, null, 2)}</pre>
      </Card>

      <Card>
        <div style={{ fontWeight: 800 }}>Driver session</div>
        {!keycloak.authenticated ? (
          <p>Login required to use driver features.</p>
        ) : (
          <>
            <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
              <Badge>{me?.status || "UNKNOWN"}</Badge>
              <Badge>{me?.is_online ? "ONLINE" : "OFFLINE"}</Badge>
              {me?.last_lat != null && <small className="muted">Last: {me.last_lat}, {me.last_lng}</small>}
            </div>

            <hr />
            <div className="row">
              <div>
                <div style={{ fontWeight: 700 }}>Location</div>
                <div className="row">
                  <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="lat" />
                  <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="lng" />
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap:"wrap" }}>
                  <Button onClick={useSample}>Use sample</Button>
                  <Button onClick={updateLocation}>Send once</Button>
                  <Button variant="primary" onClick={() => setAutoLoc(v => !v)}>{autoLoc ? "Auto: ON" : "Auto: OFF"}</Button>
                </div>
                <small className="muted">Auto sends location every 5s (demo) with slight jitter.</small>
              </div>

              <div>
                <div style={{ fontWeight: 700 }}>Availability</div>
                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap:"wrap" }}>
                  <Button variant="primary" onClick={() => setOnline(true)} disabled={busy}>Go ONLINE</Button>
                  <Button onClick={() => setOnline(false)} disabled={busy}>Go OFFLINE</Button>
                </div>
                <small className="muted">To receive trips: set location + go online.</small>
              </div>
            </div>
          </>
        )}

        {busy && <Loader label="Updating…" />}
        {msg && <p style={{ color: "green" }}>{msg}</p>}
        <ErrorBanner message={err} />
      </Card>
    </div>
  );
}
