// Phase 123 Plan 03 (A11Y-02/A11Y-03, D-13/D-16, control C5).
//
// The single source of truth for "what routes exist" and "how do we know each
// one actually rendered". Population re-derived from disk 2026-08-20:
//   ls src/pages/*.tsx      | grep -v '\.test\.' | wc -l   -> 42
//   ls src/pages/hr/*.tsx   | grep -v '\.test\.' | wc -l   -> 5   (42 + 5 = 47)
//   ls src/pages/*.tsx                           | wc -l   -> 62  <- the
//     control: includes *.test.tsx files, NEVER propagate 62 as a route count.
// Every route path below was cross-checked against src/App.tsx's <Route> table
// (single source for URL <-> component); redirect-only routes (/profiles,
// /agents, /mission-control -> <Navigate>) have no page file and are excluded.
// Routes that share a page component across a static and a dynamic path
// (/war-room + /war-room/:roomId, /hr/roster + /hr/roster/:agentId, etc.) are
// represented once, at the static path -- there is no second page file to scan.

export const THEMES = ["cyan", "emerald", "readable", "aubergine"] as const;
// "amber" is defined in src/index.css but deliberately excluded from the
// switcher and this matrix -- 122-CONTEXT.md D-04.

export type ThemeName = (typeof THEMES)[number];

/**
 * A locator DESCRIPTOR, not a locator instance -- building a Playwright
 * Locator requires a `page`, which this module (imported by both the spec and
 * any future tooling) does not have. The spec turns this into a locator with
 * a small switch.
 *
 * `null` means the route is scanned (axe still runs) but not marker-gated --
 * see the per-route comments below for why. D-13's whole point is that the
 * app-shell nav landmark is FORBIDDEN as a marker: it renders on every route
 * whether or not that route's own content does, which is the exact hole this
 * table exists to close (see e2e/theme-contrast.spec.ts's Clerk-gate check
 * for the one place that locator remains legitimate). No entry below uses it.
 */
export type RouteMarker =
  | { kind: "heading"; level: 1; name: string }
  | { kind: "testid"; value: string }
  | null;

export interface RouteEntry {
  /** Short label, not asserted for the 42 non-criterion routes -- only the 5
   *  CRITERION_PAGES names are asserted (against A11Y-01's original set). */
  name: string;
  path: string;
  marker: RouteMarker;
  /** true for exactly the 5 routes A11Y-01 measured; A11Y-02's pass/fail
   *  judgment stays on this subset even after D-16 widens the scan. */
  criterion: boolean;
}

export const ALL_ROUTES: RouteEntry[] = [
  // ── The 5 criterion routes (A11Y-01's original PAGES set) ────────────────
  // Level-1 heading text read from each page's actual PageHeader `title` /
  // hand-rolled <h1>, not assumed from the route name.
  { name: "Dashboard", path: "/", marker: { kind: "heading", level: 1, name: "Dashboard" }, criterion: true },
  { name: "LiveRun", path: "/live-run", marker: { kind: "heading", level: 1, name: "Live Run" }, criterion: true },
  { name: "Analytics", path: "/analytics", marker: { kind: "heading", level: 1, name: "Analytics" }, criterion: true },
  // ForgePage.tsx now renders its <h1> via PageHeader (Plan 123-06 landed
  // before this plan ran) -- the locator is unchanged from when it was
  // hand-rolled, so there is no cross-plan ordering dependency either way.
  { name: "Forge", path: "/forge", marker: { kind: "heading", level: 1, name: "Forge" }, criterion: true },
  { name: "Graphs", path: "/graphs", marker: { kind: "heading", level: 1, name: "Graphs Hub" }, criterion: true },

  // ── The other 42 routes -- scanned under A11Y_SCAN_ALL=1, not judged ─────
  { name: "SessionDetail", path: "/sessions/nonexistent", marker: { kind: "heading", level: 1, name: "Session Detail" }, criterion: false },
  { name: "Capabilities", path: "/capabilities", marker: { kind: "heading", level: 1, name: "Capabilities Registry" }, criterion: false },
  { name: "Alerts", path: "/alerts", marker: { kind: "heading", level: 1, name: "Alerts" }, criterion: false },
  { name: "Quality", path: "/quality", marker: { kind: "heading", level: 1, name: "Quality" }, criterion: false },
  // React Router does not 404 on a mismatched :profileId param -- this
  // renders QualityDetail's normal body with `title={profileId}`, so the
  // literal placeholder becomes the heading text itself.
  { name: "QualityDetail", path: "/quality/nonexistent", marker: { kind: "heading", level: 1, name: "nonexistent" }, criterion: false },
  { name: "Tools", path: "/tools", marker: { kind: "heading", level: 1, name: "Tools" }, criterion: false },
  { name: "Infrastructure", path: "/infrastructure", marker: { kind: "heading", level: 1, name: "Infrastructure" }, criterion: false },
  { name: "Security", path: "/security", marker: { kind: "heading", level: 1, name: "Security Dashboard" }, criterion: false },
  { name: "Ideation", path: "/ideation", marker: { kind: "heading", level: 1, name: "Ideation" }, criterion: false },
  { name: "SelfHealing", path: "/self-healing", marker: { kind: "heading", level: 1, name: "Self-Healing" }, criterion: false },
  { name: "BuildProgress", path: "/build", marker: { kind: "heading", level: 1, name: "Build Progress" }, criterion: false },
  { name: "HivePage", path: "/hive", marker: { kind: "heading", level: 1, name: "Hive Mind" }, criterion: false },
  { name: "Memory", path: "/memory", marker: { kind: "heading", level: 1, name: "Memory" }, criterion: false },
  { name: "Briefings", path: "/briefings", marker: { kind: "heading", level: 1, name: "Briefings" }, criterion: false },
  { name: "Automation", path: "/automation", marker: { kind: "heading", level: 1, name: "Automation" }, criterion: false },
  { name: "Executions", path: "/executions", marker: { kind: "heading", level: 1, name: "Execution History" }, criterion: false },
  { name: "Settings", path: "/settings", marker: { kind: "heading", level: 1, name: "Settings" }, criterion: false },
  // /chat is out of scope for the whole v15.0 milestone (PROJECT.md: "the
  // in-repo north star ... do not regress it"). Scanned for measurement only
  // -- any violation it reports is ledger-recorded, never remediated here.
  { name: "Chat", path: "/chat", marker: { kind: "heading", level: 1, name: "ÁSTRÍÐR" }, criterion: false },
  { name: "Skills", path: "/skills", marker: { kind: "heading", level: 1, name: "Skills" }, criterion: false },
  { name: "Galdr", path: "/galdr", marker: { kind: "heading", level: 1, name: "Galdr" }, criterion: false },
  { name: "Bifrost", path: "/bifrost", marker: { kind: "heading", level: 1, name: "Bifröst" }, criterion: false },
  { name: "Loom", path: "/loom", marker: { kind: "heading", level: 1, name: "Loom" }, criterion: false },
  { name: "Studio", path: "/studio", marker: { kind: "heading", level: 1, name: "Studio" }, criterion: false },
  { name: "Inbox", path: "/inbox", marker: { kind: "heading", level: 1, name: "Inbox" }, criterion: false },
  { name: "Tasks", path: "/tasks", marker: { kind: "heading", level: 1, name: "Tasks" }, criterion: false },
  { name: "ConfigPage", path: "/config", marker: { kind: "heading", level: 1, name: "Config" }, criterion: false },
  { name: "Reminders", path: "/reminders", marker: { kind: "heading", level: 1, name: "Reminders" }, criterion: false },
  { name: "InsightsChat", path: "/insights", marker: { kind: "heading", level: 1, name: "Insights" }, criterion: false },
  { name: "Dreaming", path: "/dreaming", marker: { kind: "heading", level: 1, name: "Dreaming" }, criterion: false },
  { name: "WhatsApp", path: "/channels/whatsapp", marker: { kind: "heading", level: 1, name: "WhatsApp Channel" }, criterion: false },
  { name: "WarRoom", path: "/war-room", marker: { kind: "heading", level: 1, name: "War Room" }, criterion: false },
  { name: "MeetingBot", path: "/meeting-bot", marker: { kind: "heading", level: 1, name: "Meeting Bot" }, criterion: false },
  { name: "ToolGalaxy", path: "/tool-galaxy", marker: { kind: "heading", level: 1, name: "Tool Galaxy" }, criterion: false },
  { name: "McpInventory", path: "/mcp-inventory", marker: { kind: "heading", level: 1, name: "MCP Inventory & Health" }, criterion: false },
  { name: "KnowledgeGraph", path: "/knowledge-graph", marker: { kind: "heading", level: 1, name: "KG Explorer" }, criterion: false },
  { name: "WorkspaceMap", path: "/workspace-map", marker: { kind: "heading", level: 1, name: "Workspace Map" }, criterion: false },
  { name: "DocComments", path: "/doc-comments", marker: { kind: "heading", level: 1, name: "Doc Review" }, criterion: false },
  { name: "HrAgentAnalytics", path: "/hr/analytics", marker: { kind: "heading", level: 1, name: "Agent Analytics" }, criterion: false },
  { name: "HrCatalog", path: "/hr/catalog", marker: { kind: "heading", level: 1, name: "Agent Catalog" }, criterion: false },
  { name: "HrOnboarding", path: "/hr/onboarding", marker: { kind: "heading", level: 1, name: "Onboarding" }, criterion: false },
  { name: "HrRoster", path: "/hr/roster", marker: { kind: "heading", level: 1, name: "Agent Roster" }, criterion: false },
  { name: "HrTeams", path: "/hr/teams", marker: { kind: "heading", level: 1, name: "Teams" }, criterion: false },
];

export const CRITERION_PAGES = ALL_ROUTES.filter((r) => r.criterion);
