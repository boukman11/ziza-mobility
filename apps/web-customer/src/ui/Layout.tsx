import React from "react";
import { Outlet } from "react-router-dom";
import NavItem from "@shared/ui/NavItem";
import Button from "@shared/ui/Button";
import Badge from "@shared/ui/Badge";
import { keycloak, login, logout } from "../keycloak";

export default function Layout() {
  const authed = !!keycloak.authenticated;
  const roles: string[] = (keycloak.tokenParsed as any)?.realm_access?.roles || [];

  return (
    <div className="appShell">
      <div className="topBar">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Ziza • Customer</div>
          <Badge>realm: ziza</Badge>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {authed ? (
            <>
              <Badge>{(keycloak.tokenParsed as any)?.preferred_username || "user"}</Badge>
              {roles.slice(0, 3).map((r) => (
                <Badge key={r}>{r}</Badge>
              ))}
              <Button onClick={() => logout()}>Logout</Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => login()}>Login</Button>
          )}
        </div>
      </div>

      <div className="navRow">
        <NavItem to="/" end>Dashboard</NavItem>
        <NavItem to="/estimate">Estimate</NavItem>
        <NavItem to="/trips">Trips</NavItem>
        <NavItem to="/assistance">Assistance</NavItem>
        <NavItem to="/notifications">Notifications</NavItem>
      </div>

      <div style={{ marginTop: 16 }}>
        <Outlet />
      </div>
    </div>
  );
}
