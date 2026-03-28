import React from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import RoleGate from "@shared/ui/RoleGate";
import { keycloak, login, logout } from "../keycloak";
import Dashboard from "./pages/Dashboard";
import Availability from "./pages/Availability";
import ActiveTrip from "./pages/ActiveTrip";
import Earnings from "./pages/Earnings";
import AssistanceDriver from "./pages/Assistance";
import Notifications from "./pages/Notifications";

export default function App() {
  return (
    <Routes>
      <Route
        element={
          <RoleGate
            tokenParsed={keycloak.tokenParsed as any}
            requiredRole="driver"
            appName="Driver app"
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
        <Route path="/availability" element={<Availability />} />
        <Route path="/active" element={<ActiveTrip />} />
        <Route path="/earnings" element={<Earnings />} />
        {/* Expose the Assistance page explicitly on its own route. This allows drivers
            to view and handle roadside assistance requests. */}
        <Route path="/assistance" element={<AssistanceDriver />} />
        <Route path="/notifications" element={<Notifications />} />
      </Route>
    </Routes>
  );
}
