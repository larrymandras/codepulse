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
const ConfigEditorPage = lazy(() => import("./pages/ConfigPage"));

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

// Skills browser
const Skills = lazy(() => import("./pages/Skills"));

// Phase 72: Tool / Capability Galaxy
const ToolGalaxy = lazy(() => import("./pages/ToolGalaxy"));

// Phase 73: MCP Inventory + Health (GRAPHS cluster)
const McpInventory = lazy(() => import("./pages/McpInventory"));

// Phase 74: Temporal-KG Explorer
const KnowledgeGraph = lazy(() => import("./pages/KnowledgeGraph"));

// Phase 74: HR Section stub pages
const HrRoster = lazy(() => import("./pages/hr/Roster"));
const HrCatalog = lazy(() => import("./pages/hr/Catalog"));
const HrOnboarding = lazy(() => import("./pages/hr/Onboarding"));
const HrTeams = lazy(() => import("./pages/hr/Teams"));
const HrAgentAnalytics = lazy(() => import("./pages/hr/AgentAnalytics"));

// Phase 79: Forge UI
const ForgePage = lazy(() => import("./pages/ForgePage"));

// Phase 149: Hive swarm observability
const HivePage = lazy(() => import("./pages/HivePage"));

// Phase 84: Graphs Hub
const GraphsHub = lazy(() => import("./pages/GraphsHub"));

// Doc-comment HITL review page
const DocComments = lazy(() => import("./pages/DocComments"));

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
              <Route path="/analytics" element={<Suspense fallback={<div className="text-gray-500 text-base p-8 text-center">Loading Analytics...</div>}><Analytics /></Suspense>} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/infrastructure" element={<Infrastructure />} />
              <Route path="/profiles" element={<Navigate to="/hr/roster" replace />} />
              <Route path="/agents" element={<Navigate to="/hr/roster" replace />} />
              <Route path="/security" element={<Security />} />
              <Route path="/ideation" element={<Ideation />} />
              <Route path="/self-healing" element={<SelfHealing />} />
              <Route path="/build" element={<BuildProgress />} />
              {/* Phase 79: Forge job viewer */}
              <Route path="/forge" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Forge...</div>}><ForgePage /></Suspense>} />
              {/* Phase 149: Hive swarm observability */}
              <Route path="/hive" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Hive...</div>}><HivePage /></Suspense>} />
              <Route path="/memory" element={<Memory />} />
              <Route path="/briefings" element={<Briefings />} />
              <Route path="/automation" element={<Automation />} />
              <Route path="/executions" element={<Executions />} />
              <Route path="/settings" element={<Settings />} />
              {/* Phase 56: Command Center pages */}
              <Route path="/chat" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Chat...</div>}><Chat /></Suspense>} />
              <Route path="/skills" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Skills...</div>}><Skills /></Suspense>} />
              <Route path="/live-run" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Live Run...</div>}><LiveRun /></Suspense>} />
              <Route path="/inbox" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Inbox...</div>}><InboxPage /></Suspense>} />
              <Route path="/tasks" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Tasks...</div>}><TasksPage /></Suspense>} />
              <Route path="/config" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Config...</div>}><ConfigEditorPage /></Suspense>} />
              {/* Phase 03: Interaction layer pages */}
              <Route path="/insights" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Insights...</div>}><InsightsChat /></Suspense>} />
              {/* Phase 63: Dashboard overhaul pages */}
              <Route path="/dreaming" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Dreaming...</div>}><Dreaming /></Suspense>} />
              {/* Phase 68: WhatsApp channel page */}
              <Route path="/channels/whatsapp" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading WhatsApp...</div>}><WhatsApp /></Suspense>} />
              {/* Phase 72: War Room & Meeting Suite pages */}
              <Route path="/war-room" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading War Room...</div>}><WarRoom /></Suspense>} />
              {/* Phase 90: deep-link route — same component, roomId drives auto-select */}
              <Route path="/war-room/:roomId" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading War Room...</div>}><WarRoom /></Suspense>} />
              <Route path="/meeting-bot" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Meeting Bot...</div>}><MeetingBot /></Suspense>} />
              <Route path="/mission-control" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Mission Control...</div>}><MissionControl /></Suspense>} />
              {/* Phase 84: Graphs Hub (GRAPHS cluster — hub first) */}
              <Route path="/graphs" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Graphs Hub...</div>}><GraphsHub /></Suspense>} />
              {/* Phase 72: Tool / Capability Galaxy (GRAPHS cluster) */}
              <Route path="/tool-galaxy" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Tool Galaxy...</div>}><ToolGalaxy /></Suspense>} />
              {/* Phase 73: MCP Inventory + Health (GRAPHS cluster) */}
              <Route path="/mcp-inventory" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading MCP Inventory...</div>}><McpInventory /></Suspense>} />
              {/* Phase 74: Temporal-KG Explorer (GRAPHS cluster) */}
              <Route path="/knowledge-graph" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading KG Explorer...</div>}><KnowledgeGraph /></Suspense>} />
              {/* Doc-comment HITL review page */}
              <Route path="/doc-comments" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Doc Review...</div>}><DocComments /></Suspense>} />
              {/* Phase 74: HR Section pages */}
              <Route path="/hr/roster" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Roster...</div>}><HrRoster /></Suspense>} />
              <Route path="/hr/roster/:agentId" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Roster...</div>}><HrRoster /></Suspense>} />
              <Route path="/hr/catalog" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Catalog...</div>}><HrCatalog /></Suspense>} />
              <Route path="/hr/onboarding" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Onboarding...</div>}><HrOnboarding /></Suspense>} />
              <Route path="/hr/onboarding/:catalogId" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Onboarding...</div>}><HrOnboarding /></Suspense>} />
              <Route path="/hr/teams" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Teams...</div>}><HrTeams /></Suspense>} />
              <Route path="/hr/teams/:teamId" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Teams...</div>}><HrTeams /></Suspense>} />
              <Route path="/hr/analytics" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Analytics...</div>}><HrAgentAnalytics /></Suspense>} />
            </Route>
          </Routes>
        </AuthGuard>
      </AstridrWSProvider>
    </BrowserRouter>
  );
}
