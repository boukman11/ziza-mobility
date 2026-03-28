import React from "react";
import Card from "./Card";
import Button from "./Button";
import Badge from "./Badge";

function hasRole(tokenParsed: any, role: string) {
  const roles: string[] =
    tokenParsed?.realm_access?.roles ||
    tokenParsed?.resource_access?.account?.roles ||
    [];
  return roles.includes(role);
}

export default function RoleGate({
  tokenParsed,
  requiredRole,
  appName,
  onLogin,
  onLogout,
  onRefresh,
  pendingRole,
  pendingMessage,
  children,
}: {
  tokenParsed: any;
  requiredRole: string;
  appName: string;
  onLogin: () => void;
  onLogout: () => void;
  onRefresh?: () => void | Promise<void>;
  pendingRole?: string;
  pendingMessage?: string;
  children: React.ReactNode;
}) {
  const authed = !!tokenParsed;
  const ok = authed && hasRole(tokenParsed, requiredRole);
  const isPending = authed && !!pendingRole && hasRole(tokenParsed, pendingRole);

  if (!authed) {
    return (
      <Card>
        <div style={{ fontWeight: 900, fontSize: 18 }}>{appName} login required</div>
        <p className="muted">Please authenticate to continue.</p>
        <Button variant="primary" onClick={onLogin}>Login</Button>
      </Card>
    );
  }

  if (!ok && isPending) {
    return (
      <Card>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Onboarding pending</div>
          <Badge>{pendingRole}</Badge>
        </div>
        <p className="muted" style={{ marginTop: 6 }}>
          {pendingMessage || "Your driver application is pending approval. Please check back later or refresh your token."}
        </p>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {onRefresh && <Button onClick={() => onRefresh()}>Refresh token</Button>}
          <Button variant="primary" onClick={onLogout}>Logout</Button>
        </div>
      </Card>
    );
  }

  if (!ok) {
    return (
      <Card>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Access denied</div>
          <Badge>missing role: {requiredRole}</Badge>
        </div>
        <p className="muted" style={{ marginTop: 6 }}>
          You are authenticated but do not have the required role for this app.
          If you were just upgraded (e.g. customer → driver), refresh your token or log out/in.
        </p>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {onRefresh && <Button onClick={() => onRefresh()}>Refresh token</Button>}
          <Button variant="primary" onClick={onLogout}>Logout</Button>
          <Button onClick={onLogin}>Login again</Button>
        </div>
      </Card>
    );
  }

  return <>{children}</>;
}
