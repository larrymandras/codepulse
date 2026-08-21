/**
 * navRegistry — the single source of truth for sidebar/palette navigation.
 *
 * Leaf module (imports only lucide-react) so BOTH DashboardLayout and
 * CommandPalette can consume the registry without importing each other.
 * Extracted from DashboardLayout (WR-02, phase 96 review): the previous
 * CommandPalette → DashboardLayout → CommandPalette cycle only worked
 * because all bindings were accessed at render time — any module-eval-time
 * access would have hit an uninitialized live binding.
 */

import {
  LayoutDashboard,
  Cpu,
  BarChart2,
  Bell,
  Server,
  Users,
  Shield,
  Lightbulb,
  RefreshCw,
  Bot,
  Hammer,
  Brain,
  Moon,
  ScrollText,
  Clock,
  List,
  Settings,
  TrendingUp,
  MessageSquare,
  MessageCircle,
  Activity,
  Inbox,
  KanbanSquare,
  SlidersHorizontal,
  Radio,
  Video,
  LayoutGrid,
  BookOpen,
  Wand2,
  UsersRound,
  Terminal,
  Network,
  Boxes,
  Share2,
  Flame,
  Hexagon,
  MessageSquareText,
  Gauge,
  Wrench,
  Sparkles,
  Link2,
  Waypoints,
  Radar,
  Images,
} from "lucide-react";

export const iconComponents: Record<string, React.ElementType> = {
  grid: LayoutDashboard,
  cpu: Cpu,
  chart: BarChart2,
  bell: Bell,
  server: Server,
  users: Users,
  shield: Shield,
  idea: Lightbulb,
  refresh: RefreshCw,
  bot: Bot,
  hammer: Hammer,
  brain: Brain,
  moon: Moon,
  scroll: ScrollText,
  clock: Clock,
  list: List,
  gear: Settings,
  message: MessageSquare,
  activity: Activity,
  inbox: Inbox,
  kanban: KanbanSquare,
  sliders: SlidersHorizontal,
  insights: TrendingUp,
  whatsapp: MessageCircle,
  radio: Radio,
  video: Video,
  layout: LayoutGrid,
  "book-open": BookOpen,
  "wand-2": Wand2,
  "users-round": UsersRound,
  // Phase 71 IA refactor — new cluster icons
  terminal: Terminal,
  network: Network,
  boxes: Boxes,
  "share-2": Share2,
  flame: Flame,
  hexagon: Hexagon,   // Phase 149 — Hive page
  "message-square-text": MessageSquareText,
  gauge: Gauge,   // Phase 93 — Quality page
  wrench: Wrench,   // Phase 105 — Tools page
  sparkles: Sparkles,   // Phase 116 — Galdr page
  "link-2": Link2,   // Phase 117 — Bifröst page
  waypoints: Waypoints,   // Phase 119 — Loom page
  radar: Radar,   // Phase 114 — Workspace Map page
  images: Images,   // Phase 118 — Studio page
};

// Every nav item is a real route. A `placeholder?: boolean` capability used to
// exist here for not-yet-built routes, rendered as disabled "soon" entries by
// DashboardLayout — but ZERO items ever set it, so the branch was dead code.
// Removed at Phase 123's closeout (D-18): the disabled style it carried used an
// `opacity-50` treatment that was chosen forward-looking and never measured for
// contrast, so it was an unverified accessibility decision that would have
// shipped the moment anyone added the first placeholder. Dead code carrying an
// unmeasured a11y decision is worse than no code. Re-add deliberately, with a
// measured disabled style, if "soon" entries are ever wanted.
export interface NavItem {
  to: string;
  label: string;
  icon: string;
  group: string;
}

export interface NavGroupConfig {
  group: string;
  items: NavItem[];
}

// Phase 124 SHELL-02 regroup: 5 groups -> 4 domains (Command, Observe,
// Agents, System). No `to` path changed — the golden-fixture test at
// src/lib/__tests__/navRegistry.routes.test.ts guards the route set. Group
// strings moved from UPPERCASE to sentence case ("Command" not "COMMAND")
// because the breadcrumb (Phase 124 D-16) reads this string directly and
// renders it in sentence-case Geist; the sidebar's eyebrow header uppercases
// it via CSS instead, so there is one source of truth for the display
// string. The domain split follows D-02 (GRAPHS splits by intent:
// visualisation surfaces join Observe, inventory surfaces join System) and
// D-03 (ACTIVITY's Ástríðr-authored output/channels join Agents; Automation,
// being plumbing, joins System). Settings still lives in the footer UserMenu
// rather than a nav domain (D-04) — unchanged by this phase.
//
// (Replaces a stale "Phase 71 IA refactor — 6 clusters" comment that
// previously stood here — that count was already wrong before this phase
// touched it: the file held 5 groups, not 6.)
export const navGroups: NavGroupConfig[] = [
  {
    group: "Command",
    items: [
      { to: "/chat", label: "Chat", icon: "message", group: "Command" },
      { to: "/live-run", label: "Live Run", icon: "activity", group: "Command" },
      { to: "/inbox", label: "Inbox", icon: "inbox", group: "Command" },
      { to: "/tasks", label: "Tasks", icon: "kanban", group: "Command" },
      { to: "/skills", label: "Skills", icon: "wand-2", group: "Command" },
      // Adjacent to Skills on purpose: both are curated-content-library tools.
      { to: "/galdr", label: "Galdr", icon: "sparkles", group: "Command" },
      // Bifröst sits beside Galdr: both are Seiðr Suite curated-library surfaces.
      { to: "/bifrost", label: "Bifröst", icon: "link-2", group: "Command" },
      // Studio is the fourth Seiðr Suite surface (D-16): a curated media
      // library alongside Galdr (prompts) and Bifröst (links).
      { to: "/studio", label: "Studio", icon: "images", group: "Command" },
      { to: "/reminders", label: "Reminders", icon: "clock", group: "Command" },
      { to: "/doc-comments", label: "Doc Review", icon: "message-square-text", group: "Command" },
      { to: "/forge", label: "Forge", icon: "flame", group: "Command" },
    ],
  },
  {
    group: "Observe",
    items: [
      { to: "/", label: "Dashboard", icon: "grid", group: "Observe" },
      { to: "/hive", label: "Hive", icon: "hexagon", group: "Observe" },
      { to: "/executions", label: "Executions", icon: "list", group: "Observe" },
      { to: "/build", label: "Build", icon: "hammer", group: "Observe" },
      // D-05: disambiguated from /hr/analytics's renamed label below — this
      // was the only duplicate label in the registry.
      { to: "/analytics", label: "Analytics", icon: "chart", group: "Observe" },
      { to: "/alerts", label: "Alerts", icon: "bell", group: "Observe" },
      { to: "/quality", label: "Quality", icon: "gauge", group: "Observe" },
      { to: "/memory", label: "Memory", icon: "brain", group: "Observe" },
      { to: "/insights", label: "Insights", icon: "insights", group: "Observe" },
      { to: "/graphs", label: "Graphs Hub", icon: "network", group: "Observe" },
      // Loom is a visualisation surface (React Flow pipeline) — it answers
      // "what is happening", so D-02 moves it here with the other graph
      // surfaces rather than leaving it in the dissolved GRAPHS group.
      { to: "/loom", label: "Loom", icon: "waypoints", group: "Observe" },
      { to: "/knowledge-graph", label: "KG Explorer", icon: "share-2", group: "Observe" },
      { to: "/workspace-map", label: "Workspace Map", icon: "radar", group: "Observe" },
      // "Mission Control" removed (WR-03): merged into Tasks — By Agent view
      // (phase 96 Plan 04, D-02). /mission-control still redirects to
      // /tasks?view=agent in App.tsx, so deep links keep working.
    ],
  },
  {
    group: "Agents",
    items: [
      { to: "/hr/roster", label: "Roster", icon: "users", group: "Agents" },
      { to: "/hr/catalog", label: "Catalog", icon: "book-open", group: "Agents" },
      { to: "/hr/onboarding", label: "Onboarding", icon: "wand-2", group: "Agents" },
      { to: "/hr/teams", label: "Teams", icon: "users-round", group: "Agents" },
      // D-05 rename: was "Analytics", identical to /analytics's label.
      { to: "/hr/analytics", label: "Agent Analytics", icon: "chart", group: "Agents" },
      { to: "/briefings", label: "Briefings", icon: "scroll", group: "Agents" },
      { to: "/ideation", label: "Ideation", icon: "idea", group: "Agents" },
      { to: "/dreaming", label: "Dreaming", icon: "moon", group: "Agents" },
      { to: "/war-room", label: "War Room", icon: "radio", group: "Agents" },
      { to: "/meeting-bot", label: "Meeting Bot", icon: "video", group: "Agents" },
      { to: "/channels/whatsapp", label: "WhatsApp", icon: "whatsapp", group: "Agents" },
    ],
  },
  {
    group: "System",
    items: [
      { to: "/config", label: "Config", icon: "sliders", group: "System" },
      { to: "/tools", label: "Tools", icon: "wrench", group: "System" },
      { to: "/infrastructure", label: "Infrastructure", icon: "server", group: "System" },
      { to: "/security", label: "Security", icon: "shield", group: "System" },
      { to: "/self-healing", label: "Self-Healing", icon: "refresh", group: "System" },
      { to: "/tool-galaxy", label: "Tool Galaxy", icon: "boxes", group: "System" },
      { to: "/mcp-inventory", label: "MCP Inventory", icon: "server", group: "System" },
      { to: "/capabilities", label: "Capabilities", icon: "cpu", group: "System" },
      { to: "/automation", label: "Automation", icon: "clock", group: "System" },
    ],
  },
];

// Flat list of routes (deduped by `to`) for CommandPalette and any other
// consumer of the nav registry. The former `item.placeholder || !item.to`
// skip is gone with the placeholder capability; `to` is now required, so
// TypeScript enforces what that guard used to check at runtime.
export const navItems = (() => {
  const seen = new Set<string>();
  const flat: NavItem[] = [];
  for (const grp of navGroups) {
    for (const item of grp.items) {
      if (seen.has(item.to)) continue;
      seen.add(item.to);
      flat.push(item);
    }
  }
  return flat;
})();
