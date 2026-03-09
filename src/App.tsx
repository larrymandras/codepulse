import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AuthGuard from "./components/AuthGuard";
import DashboardLayout from "./layouts/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import SessionDetail from "./pages/SessionDetail";
import Capabilities from "./pages/Capabilities";
import Analytics from "./pages/Analytics";
import Alerts from "./pages/Alerts";
import Infrastructure from "./pages/Infrastructure";
import Profiles from "./pages/Profiles";
import Security from "./pages/Security";
import SelfHealing from "./pages/SelfHealing";
import BuildProgress from "./pages/BuildProgress";
import Settings from "./pages/Settings";

// Lazy-load Forge (Three.js is ~1MB) — only downloaded when user navigates to /forge
const Forge = lazy(() => import("./pages/Forge"));

export default function App() {
  return (
    <BrowserRouter>
      <AuthGuard>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sessions/:id" element={<SessionDetail />} />
            <Route path="/capabilities" element={<Capabilities />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/infrastructure" element={<Infrastructure />} />
            <Route path="/profiles" element={<Profiles />} />
            <Route path="/security" element={<Security />} />
            <Route path="/self-healing" element={<SelfHealing />} />
            <Route path="/build" element={<BuildProgress />} />
            <Route path="/forge" element={<Suspense fallback={<div className="text-gray-500 text-sm p-8 text-center">Loading Forge...</div>}><Forge /></Suspense>} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </AuthGuard>
    </BrowserRouter>
  );
}
