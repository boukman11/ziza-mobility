import React from "react";
import Card from "./Card";
import Button from "./Button";

export default function RequireAuth({
  authed,
  onLogin,
  children,
  label="Login required",
}: {
  authed: boolean;
  onLogin: () => void;
  children: React.ReactNode;
  label?: string;
}) {
  if (authed) return <>{children}</>;
  return (
    <Card>
      <div style={{fontWeight:700}}>{label}</div>
      <p className="muted" style={{marginTop:6}}>Please authenticate to continue.</p>
      <Button variant="primary" onClick={onLogin}>Login</Button>
    </Card>
  );
}
