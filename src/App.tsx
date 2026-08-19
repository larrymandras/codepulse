import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import AuthGuard from "./components/AuthGuard";
import DashboardLayout from "./layouts/DashboardLayout";
import { AstridrWSProvider } from "./contexts/AstridrWSContext";
import { ProactiveAlertListener } from "./components/ProactiveAlertListener";
import { FocusExitDigest } from "./components/inbox/FocusExitDigest";
import LoadingState from "./components/LoadingState";

// Phase 106 Plan 04 (DEBT-03): these fourteen pages used to be plain top-level
// imports, which pulled their whole component graphs -- Recharts, @xyflow,
// @dnd-kit and the rest -- into the entry chunk every visitor downloads
// regardless of which route they open. They now follow the same route-level
// lazy convention as every other page in this file. Dashboard is included
// deliberately: leaving the landing route eager kept its entire panel graph in
// the entry bundle, which was the specific defect. Re-introducing a top-level
// page import here is guarded by a source-shape test in App.test.tsx.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SessionDetail = lazy(() => import("./pages/SessionDetail"));
const Capabilities = lazy(() => import("./pages/Capabilities"));
const Alerts = lazy(() => import("./pages/Alerts"));
const Infrastructure = lazy(() => import("./pages/Infrastructure"));
const Security = lazy(() => import("./pages/Security"));
const SelfHealing = lazy(() => import("./pages/SelfHealing"));
const BuildProgress = lazy(() => import("./pages/BuildProgress"));
const Settings = lazy(() => import("./pages/Settings"));
const Memory = lazy(() => import("./pages/Memory"));
const Briefings = lazy(() => import("./pages/Briefings"));
const Automation = lazy(() => import("./pages/Automation"));
const Executions = lazy(() => import("./pages/Executions"));
const Ideation = lazy(() => import("./pages/Ideation"));

// Lazy-load heavy pages
const Analytics = lazy(() => import("./pages/Analytics"));

// Phase 93: Quality KPI pages (EVAL-03)
const Quality = lazy(() => import("./pages/Quality"));
const QualityDetail = lazy(() => import("./pages/QualityDetail"));

// Phase 105: Tool & Trace Observability (OBS-01/OBS-02)
const Tools = lazy(() => import("./pages/Tools"));

// Lazy-load command center pages (Phase 56)
const Chat = lazy(() => import("./pages/Chat"));
const LiveRun = lazy(() => import("./pages/LiveRun"));
const InboxPage = lazy(() => import("./pages/Inbox"));
const TasksPage = lazy(() => import("./pages/Tasks"));
const ConfigEditorPage = lazy(() => import("./pages/ConfigPage"));
// Phase 101: Reminders & Calendar Command Center (D-08)
const RemindersPage = lazy(() => import("./pages/Reminders"));

// Lazy-load interaction layer pages (Phase 03)
const InsightsChat = lazy(() => import("./pages/InsightsChat"));

// Lazy-load Phase 63 pages
const Dreaming = lazy(() => import("./pages/Dreaming"));

// Lazy-load Phase 68 pages
const WhatsApp = lazy(() => import("./pages/WhatsApp"));

// Lazy-load Phase 72 pages
const WarRoom = lazy(() => import("./pages/WarRoom"));
const MeetingBot = lazy(() => import("./pages/MeetingBot"));

// Skills browser
const Skills = lazy(() => import("./pages/Skills"));

// Phase 116: Galdr prompt library
const Galdr = lazy(() => import("./pages/Galdr"));

// Phase 117: Bifröst link hub
const Bifrost = lazy(() => import("./pages/Bifrost"));

// Phase 119: Loom curated pipelines
const Loom = lazy(() => import("./pages/Loom"));

// Phase 118: Studio media gallery
const Studio = lazy(() => import("./pages/Studio"));

// Phase 72: Tool / Capability Galaxy
const ToolGalaxy = lazy(() => import("./pages/ToolGalaxy"));

// Phase 73: MCP Inventory + Health (GRAPHS cluster)
const McpInventory = lazy(() => import("./pages/McpInventory"));

// Phase 74: Temporal-KG Explorer
const KnowledgeGraph = lazy(() => import("./pages/KnowledgeGraph"));

// Phase 114: Workspace Map view (GRAPHS cluster)
const WorkspaceMap = lazy(() => import("./pages/WorkspaceMap"));

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
        {/* Phase 186 checkpoint round 5 (D-09 page-scoping fix): both
            headless listeners are mounted ONCE here, app-wide, so a toast
            fires regardless of which page is active -- moved out of
            Chat.tsx, which previously meant they only ever fired while
            /chat happened to be mounted. */}
        <ProactiveAlertListener />
        <FocusExitDigest />
        <AuthGuard>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Suspense fallback={<LoadingState shape="page" />}><Dashboard /></Suspense>} />
              <Route path="/sessions/:id" element={<Suspense fallback={<LoadingState shape="page" />}><SessionDetail /></Suspense>} />
              <Route path="/capabilities" element={<Suspense fallback={<LoadingState shape="page" />}><Capabilities /></Suspense>} />
              <Route path="/analytics" element={<Suspense fallback={<LoadingState shape="page" />}><Analytics /></Suspense>} />
              <Route path="/alerts" element={<Suspense fallback={<LoadingState shape="page" />}><Alerts /></Suspense>} />
              {/* Phase 93: Quality KPI pages (EVAL-03) */}
              <Route path="/quality" element={<Suspense fallback={<LoadingState shape="page" />}><Quality /></Suspense>} />
              <Route path="/quality/:profileId" element={<Suspense fallback={<LoadingState shape="page" />}><QualityDetail /></Suspense>} />
              {/* Phase 105: Tool & Trace Observability (OBS-01/OBS-02) */}
              <Route path="/tools" element={<Suspense fallback={<LoadingState shape="page" />}><Tools /></Suspense>} />
              <Route path="/infrastructure" element={<Suspense fallback={<LoadingState shape="page" />}><Infrastructure /></Suspense>} />
              <Route path="/profiles" element={<Navigate to="/hr/roster" replace />} />
              <Route path="/agents" element={<Navigate to="/hr/roster" replace />} />
              <Route path="/security" element={<Suspense fallback={<LoadingState shape="page" />}><Security /></Suspense>} />
              <Route path="/ideation" element={<Suspense fallback={<LoadingState shape="page" />}><Ideation /></Suspense>} />
              <Route path="/self-healing" element={<Suspense fallback={<LoadingState shape="page" />}><SelfHealing /></Suspense>} />
              <Route path="/build" element={<Suspense fallback={<LoadingState shape="page" />}><BuildProgress /></Suspense>} />
              {/* Phase 79: Forge job viewer */}
              <Route path="/forge" element={<Suspense fallback={<LoadingState shape="page" />}><ForgePage /></Suspense>} />
              {/* Phase 149: Hive swarm observability */}
              <Route path="/hive" element={<Suspense fallback={<LoadingState shape="page" />}><HivePage /></Suspense>} />
              <Route path="/memory" element={<Suspense fallback={<LoadingState shape="page" />}><Memory /></Suspense>} />
              <Route path="/briefings" element={<Suspense fallback={<LoadingState shape="page" />}><Briefings /></Suspense>} />
              <Route path="/automation" element={<Suspense fallback={<LoadingState shape="page" />}><Automation /></Suspense>} />
              <Route path="/executions" element={<Suspense fallback={<LoadingState shape="page" />}><Executions /></Suspense>} />
              <Route path="/settings" element={<Suspense fallback={<LoadingState shape="page" />}><Settings /></Suspense>} />
              {/* Phase 56: Command Center pages */}
              <Route path="/chat" element={<Suspense fallback={<LoadingState shape="page" />}><Chat /></Suspense>} />
              <Route path="/skills" element={<Suspense fallback={<LoadingState shape="page" />}><Skills /></Suspense>} />
              {/* Phase 116: Galdr prompt library */}
              <Route path="/galdr" element={<Suspense fallback={<LoadingState shape="page" />}><Galdr /></Suspense>} />
              {/* Phase 117: Bifröst link hub */}
              <Route path="/bifrost" element={<Suspense fallback={<LoadingState shape="page" />}><Bifrost /></Suspense>} />
              {/* Phase 119: Loom curated pipelines */}
              <Route path="/loom" element={<Suspense fallback={<LoadingState shape="page" />}><Loom /></Suspense>} />
              {/* Phase 118: Studio media gallery */}
              <Route path="/studio" element={<Suspense fallback={<LoadingState shape="page" />}><Studio /></Suspense>} />
              <Route path="/live-run" element={<Suspense fallback={<LoadingState shape="page" />}><LiveRun /></Suspense>} />
              <Route path="/inbox" element={<Suspense fallback={<LoadingState shape="page" />}><InboxPage /></Suspense>} />
              <Route path="/tasks" element={<Suspense fallback={<LoadingState shape="page" />}><TasksPage /></Suspense>} />
              <Route path="/config" element={<Suspense fallback={<LoadingState shape="page" />}><ConfigEditorPage /></Suspense>} />
              {/* Phase 101: Reminders & Calendar Command Center (D-08) */}
              <Route path="/reminders" element={<Suspense fallback={<LoadingState shape="page" />}><RemindersPage /></Suspense>} />
              {/* Phase 03: Interaction layer pages */}
              <Route path="/insights" element={<Suspense fallback={<LoadingState shape="page" />}><InsightsChat /></Suspense>} />
              {/* Phase 63: Dashboard overhaul pages */}
              <Route path="/dreaming" element={<Suspense fallback={<LoadingState shape="page" />}><Dreaming /></Suspense>} />
              {/* Phase 68: WhatsApp channel page */}
              <Route path="/channels/whatsapp" element={<Suspense fallback={<LoadingState shape="page" />}><WhatsApp /></Suspense>} />
              {/* Phase 72: War Room & Meeting Suite pages */}
              <Route path="/war-room" element={<Suspense fallback={<LoadingState shape="page" />}><WarRoom /></Suspense>} />
              {/* Phase 90: deep-link route — same component, roomId drives auto-select */}
              <Route path="/war-room/:roomId" element={<Suspense fallback={<LoadingState shape="page" />}><WarRoom /></Suspense>} />
              <Route path="/meeting-bot" element={<Suspense fallback={<LoadingState shape="page" />}><MeetingBot /></Suspense>} />
              {/* Phase 96 Plan 04 (D-02): Mission Control merged into Tasks — By Agent view */}
              <Route path="/mission-control" element={<Navigate to="/tasks?view=agent" replace />} />
              {/* Phase 84: Graphs Hub (GRAPHS cluster — hub first) */}
              <Route path="/graphs" element={<Suspense fallback={<LoadingState shape="page" />}><GraphsHub /></Suspense>} />
              {/* Phase 72: Tool / Capability Galaxy (GRAPHS cluster) */}
              <Route path="/tool-galaxy" element={<Suspense fallback={<LoadingState shape="page" />}><ToolGalaxy /></Suspense>} />
              {/* Phase 73: MCP Inventory + Health (GRAPHS cluster) */}
              <Route path="/mcp-inventory" element={<Suspense fallback={<LoadingState shape="page" />}><McpInventory /></Suspense>} />
              {/* Phase 74: Temporal-KG Explorer (GRAPHS cluster) */}
              <Route path="/knowledge-graph" element={<Suspense fallback={<LoadingState shape="page" />}><KnowledgeGraph /></Suspense>} />
              {/* Phase 114: Workspace Map view (GRAPHS cluster) */}
              <Route path="/workspace-map" element={<Suspense fallback={<LoadingState shape="page" />}><WorkspaceMap /></Suspense>} />
              {/* Doc-comment HITL review page */}
              <Route path="/doc-comments" element={<Suspense fallback={<LoadingState shape="page" />}><DocComments /></Suspense>} />
              {/* Phase 74: HR Section pages */}
              <Route path="/hr/roster" element={<Suspense fallback={<LoadingState shape="page" />}><HrRoster /></Suspense>} />
              <Route path="/hr/roster/:agentId" element={<Suspense fallback={<LoadingState shape="page" />}><HrRoster /></Suspense>} />
              <Route path="/hr/catalog" element={<Suspense fallback={<LoadingState shape="page" />}><HrCatalog /></Suspense>} />
              <Route path="/hr/onboarding" element={<Suspense fallback={<LoadingState shape="page" />}><HrOnboarding /></Suspense>} />
              <Route path="/hr/onboarding/:catalogId" element={<Suspense fallback={<LoadingState shape="page" />}><HrOnboarding /></Suspense>} />
              <Route path="/hr/teams" element={<Suspense fallback={<LoadingState shape="page" />}><HrTeams /></Suspense>} />
              <Route path="/hr/teams/:teamId" element={<Suspense fallback={<LoadingState shape="page" />}><HrTeams /></Suspense>} />
              <Route path="/hr/analytics" element={<Suspense fallback={<LoadingState shape="page" />}><HrAgentAnalytics /></Suspense>} />
            </Route>
          </Routes>
        </AuthGuard>
      </AstridrWSProvider>
    </BrowserRouter>
  );
}
