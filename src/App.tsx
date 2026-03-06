import { BrowserRouter, Routes, Route } from "react-router-dom";
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

export default function App() {
  return (
    <BrowserRouter>
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
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
