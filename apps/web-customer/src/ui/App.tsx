import React from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import RoleGate from "@shared/ui/RoleGate";
import { keycloak, login, logout } from "../keycloak";
import Dashboard from "./pages/Dashboard";
import Estimate from "./pages/Estimate";
import Confirm from "./pages/Confirm";
import Trips from "./pages/Trips";
import AssistancePage from "./pages/Assistance";
import TripDetail from "./pages/TripDetail";
import Track from "./pages/Track";
import Notifications from "./pages/Notifications";

export default function App() {
  return (
    <Routes>
      <Route
        element={
          <RoleGate
            tokenParsed={keycloak.tokenParsed as any}
            requiredRole="customer"
            appName="Customer app"
            onLogin={login}
            onLogout={logout}
            onRefresh={async () => {
              await keycloak.updateToken(0);
              window.location.reload();
            }}
          >
            <Layout />
          </RoleGate>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/estimate" element={<Estimate />} />
        <Route path="/confirm" element={<Confirm />} />
        <Route path="/track" element={<Track />} />
        <Route path="/trips" element={<Trips />} />
        <Route path="/assistance" element={<AssistancePage />} />
        <Route path="/trips/:tripId" element={<TripDetail />} />
        <Route path="/track/:tripId" element={<Track />} />
        <Route path="/notifications" element={<Notifications />} />
      </Route>
    </Routes>
  );
}
