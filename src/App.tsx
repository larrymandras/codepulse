import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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

// Lazy-load Phase 72 pages
const WarRoom = lazy(() => import("./pages/WarRoom"));
const MeetingBot = lazy(() => import("./pages/MeetingBot"));
const MissionControl = lazy(() => import("./pages/MissionControl"));

// Tool Matrix page
const ToolMatrixPage = lazy(() => import("./pages/ToolMatrix"));

// Phase 59: Operations page
const Operations = lazy(() => import("./pages/Operations"));

// Phase 01: Design Studio
const DesignStudio = lazy(() => import("./pages/DesignStudio"));

// Phase 095: Transcript viewer
const Transcripts = lazy(() => import("./pages/Transcripts"));

// Phase 098: Session Kanban
const SessionKanban = lazy(() => import("./pages/SessionKanban"));

// Phase 74: HR Section stub pages
const HrRoster = lazy(() => import("./pages/hr/Roster"));
const HrCatalog = lazy(() => import("./pages/hr/Catalog"));
const HrOnboarding = lazy(() => import("./pages/hr/Onboarding"));
const HrTeams = lazy(() => import("./pages/hr/Teams"));
const HrAgentAnalytics = lazy(() => import("./pages/hr/AgentAnalytics"));

export default function App() {
  return (
    <BrowserRouter>
      <AstridrWSProvider>
        <AuthGuard>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/sessions" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Sessions...</div>}><SessionKanban /></Suspense>} />
              <Route path="/sessions/:id" element={<SessionDetail />} />
              <Route path="/capabilities" element={<Capabilities />} />
              <Route path="/analytics" element={<Suspense fallback={<div className="text-gray-500 text-sm p-8 text-center">Loading Analytics...</div>}><Analytics /></Suspense>} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/infrastructure" element={<Infrastructure />} />
              <Route path="/profiles" element={<Navigate to="/hr/roster" replace />} />
              <Route path="/agents" element={<Navigate to="/hr/roster" replace />} />
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
              {/* Phase 72: War Room & Meeting Suite pages */}
              <Route path="/war-room" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading War Room...</div>}><WarRoom /></Suspense>} />
              <Route path="/meeting-bot" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Meeting Bot...</div>}><MeetingBot /></Suspense>} />
              <Route path="/mission-control" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Mission Control...</div>}><MissionControl /></Suspense>} />
              {/* Tool Matrix page */}
              <Route path="/tool-matrix" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Tool Matrix...</div>}><ToolMatrixPage /></Suspense>} />
              {/* Phase 59: Operations page */}
              <Route path="/operations" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Operations...</div>}><Operations /></Suspense>} />
              {/* Phase 01: Design Studio */}
              <Route path="/design-studio" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Design Studio...</div>}><DesignStudio /></Suspense>} />
              {/* Phase 095: Transcript viewer */}
              <Route path="/transcripts" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Transcripts...</div>}><Transcripts /></Suspense>} />
              {/* Phase 74: HR Section pages */}
              <Route path="/hr/roster" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Roster...</div>}><HrRoster /></Suspense>} />
              <Route path="/hr/roster/:agentId" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Roster...</div>}><HrRoster /></Suspense>} />
              <Route path="/hr/catalog" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Catalog...</div>}><HrCatalog /></Suspense>} />
              <Route path="/hr/onboarding" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Onboarding...</div>}><HrOnboarding /></Suspense>} />
              <Route path="/hr/onboarding/:catalogId" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Onboarding...</div>}><HrOnboarding /></Suspense>} />
              <Route path="/hr/teams" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Teams...</div>}><HrTeams /></Suspense>} />
              <Route path="/hr/teams/:teamId" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Teams...</div>}><HrTeams /></Suspense>} />
              <Route path="/hr/analytics" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Analytics...</div>}><HrAgentAnalytics /></Suspense>} />
            </Route>
          </Routes>
        </AuthGuard>
      </AstridrWSProvider>
    </BrowserRouter>
  );
}
