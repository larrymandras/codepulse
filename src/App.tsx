import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AuthGuard from "./components/AuthGuard";
import DashboardLayout from "./layouts/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import SessionDetail from "./pages/SessionDetail";
import Capabilities from "./pages/Capabilities";
// Analytics is lazy-loaded below
import Alerts from "./pages/Alerts";
import Infrastructure from "./pages/Infrastructure";
import Profiles from "./pages/Profiles";
import Security from "./pages/Security";
import SelfHealing from "./pages/SelfHealing";
import BuildProgress from "./pages/BuildProgress";
import Settings from "./pages/Settings";
import Memory from "./pages/Memory";
import Briefings from "./pages/Briefings";
import Automation from "./pages/Automation";
import Executions from "./pages/Executions";
import Ideation from "./pages/Ideation";
import { AstridrWSProvider } from "./contexts/AstridrWSContext";

// Lazy-load heavy pages
const Agents = lazy(() => import("./pages/Agents"));
const Analytics = lazy(() => import("./pages/Analytics"));

// Lazy-load command center pages (Phase 56)
const Chat = lazy(() => import("./pages/Chat"));
const LiveRun = lazy(() => import("./pages/LiveRun"));
const InboxPage = lazy(() => import("./pages/Inbox"));
const TasksPage = lazy(() => import("./pages/Tasks"));
const ConfigEditorPage = lazy(() => import("./pages/ConfigEditor"));

// Lazy-load interaction layer pages (Phase 03)
const InsightsChat = lazy(() => import("./pages/InsightsChat"));

// Lazy-load Phase 63 pages
const Dreaming = lazy(() => import("./pages/Dreaming"));

// Lazy-load Phase 68 pages
const WhatsApp = lazy(() => import("./pages/WhatsApp"));

export default function App() {
  return (
    <BrowserRouter>
      <AstridrWSProvider>
        <AuthGuard>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/sessions/:id" element={<SessionDetail />} />
              <Route path="/capabilities" element={<Capabilities />} />
              <Route path="/analytics" element={<Suspense fallback={<div className="text-gray-500 text-sm p-8 text-center">Loading Analytics...</div>}><Analytics /></Suspense>} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/infrastructure" element={<Infrastructure />} />
              <Route path="/profiles" element={<Profiles />} />
              <Route path="/agents" element={<Suspense fallback={<div className="text-gray-500 text-sm p-8 text-center">Loading Agents...</div>}><Agents /></Suspense>} />
              <Route path="/security" element={<Security />} />
              <Route path="/ideation" element={<Ideation />} />
              <Route path="/self-healing" element={<SelfHealing />} />
              <Route path="/build" element={<BuildProgress />} />
              <Route path="/memory" element={<Memory />} />
              <Route path="/briefings" element={<Briefings />} />
              <Route path="/automation" element={<Automation />} />
              <Route path="/executions" element={<Executions />} />
              <Route path="/settings" element={<Settings />} />
              {/* Phase 56: Command Center pages */}
              <Route path="/chat" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Chat...</div>}><Chat /></Suspense>} />
              <Route path="/live-run" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Live Run...</div>}><LiveRun /></Suspense>} />
              <Route path="/inbox" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Inbox...</div>}><InboxPage /></Suspense>} />
              <Route path="/tasks" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Tasks...</div>}><TasksPage /></Suspense>} />
              <Route path="/config" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Config...</div>}><ConfigEditorPage /></Suspense>} />
              {/* Phase 03: Interaction layer pages */}
              <Route path="/insights" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Insights...</div>}><InsightsChat /></Suspense>} />
              {/* Phase 63: Dashboard overhaul pages */}
              <Route path="/dreaming" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Dreaming...</div>}><Dreaming /></Suspense>} />
              {/* Phase 68: WhatsApp channel page */}
              <Route path="/channels/whatsapp" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading WhatsApp...</div>}><WhatsApp /></Suspense>} />
            </Route>
          </Routes>
        </AuthGuard>
      </AstridrWSProvider>
    </BrowserRouter>
  );
}
