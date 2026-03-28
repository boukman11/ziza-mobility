import React from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import RoleGate from "@shared/ui/RoleGate";
import RequireAuth from "@shared/ui/RequireAuth";
import { keycloak, login, logout } from "../keycloak";
import Dashboard from "./pages/Dashboard";
import Trips from "./pages/Trips";
import TripDetail from "./pages/TripDetail";
import Drivers from "./pages/Drivers";
import Users from "./pages/Users";
import DriverOnboarding from "./pages/DriverOnboarding";
import AdminAssistance from "./pages/Assistance";
import SystemStatus from "./pages/SystemStatus";
import Payments from "./pages/Payments";
import Payouts from "./pages/Payouts";
import Jobs from "./pages/Jobs";
import Outbox from "./pages/Outbox";
import Audit from "./pages/Audit";
import Notifications from "./pages/Notifications";
import Assistances from "./pages/Assistances";
import Pricing from "./pages/Pricing";

export default function App() {
  return (
    <Routes>
      <Route element={<RoleGate onRefresh={async () => { await keycloak.updateToken(0); window.location.reload(); }}  tokenParsed={keycloak.tokenParsed} requiredRole="admin" appName="Admin app" onLogin={login} onLogout={logout}><Layout /></RoleGate>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/trips" element={<Trips />} />
        <Route path="/trips/:tripId" element={<TripDetail />} />
        <Route path="/drivers" element={<Drivers />} />
        <Route path="/users" element={<Users />} />
        <Route path="/onboarding" element={<DriverOnboarding />} />
        <Route path="/assistance" element={<AdminAssistance />} />
        <Route path="/system" element={<SystemStatus />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/payouts" element={<Payouts />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/outbox" element={<Outbox />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/assistances" element={<Assistances />} />
        <Route path="/pricing" element={<Pricing />} />
      </Route>
    </Routes>
  );
}
