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
};

// A nav item is either a real route (has `to`) or a placeholder label for a
// not-yet-built route (`placeholder: true`, no live `to`). Placeholders render
// as disabled "soon" entries and are EXCLUDED from the flat navItems export.
export interface NavItem {
  to?: string;
  label: string;
  icon: string;
  group: string;
  placeholder?: boolean;
}

export interface NavGroupConfig {
  group: string;
  items: NavItem[];
}

// Phase 71 IA refactor — 6 clusters. No existing `to` path changed; new phase
// routes are registered as placeholder labels only (Settings stays in the
// footer UserMenu, not a nav cluster).
export const navGroups: NavGroupConfig[] = [
  {
    group: "COMMAND",
    items: [
      { to: "/chat", label: "Chat", icon: "message", group: "COMMAND" },
      { to: "/live-run", label: "Live Run", icon: "activity", group: "COMMAND" },
      { to: "/inbox", label: "Inbox", icon: "inbox", group: "COMMAND" },
      { to: "/tasks", label: "Tasks", icon: "kanban", group: "COMMAND" },
      { to: "/config", label: "Config", icon: "sliders", group: "COMMAND" },
      { to: "/skills", label: "Skills", icon: "wand-2", group: "COMMAND" },
      { to: "/reminders", label: "Reminders", icon: "clock", group: "COMMAND" },
      { to: "/doc-comments", label: "Doc Review", icon: "message-square-text", group: "COMMAND" },
      { to: "/forge", label: "Forge", icon: "flame", group: "COMMAND" },
    ],
  },
  {
    group: "GRAPHS",
    items: [
      { to: "/graphs", label: "Graphs Hub", icon: "network", group: "GRAPHS" },
      { to: "/tool-galaxy", label: "Tool Galaxy", icon: "boxes", group: "GRAPHS" },
      { to: "/mcp-inventory", label: "MCP Inventory", icon: "server", group: "GRAPHS" },
      { to: "/knowledge-graph", label: "KG Explorer", icon: "share-2", group: "GRAPHS" },
      { to: "/capabilities", label: "Capabilities", icon: "cpu", group: "GRAPHS" },
    ],
  },
  {
    group: "AGENTS",
    items: [
      { to: "/hr/roster", label: "Roster", icon: "users", group: "AGENTS" },
      { to: "/hr/catalog", label: "Catalog", icon: "book-open", group: "AGENTS" },
      { to: "/hr/onboarding", label: "Onboarding", icon: "wand-2", group: "AGENTS" },
      { to: "/hr/teams", label: "Teams", icon: "users-round", group: "AGENTS" },
      { to: "/hr/analytics", label: "Analytics", icon: "chart", group: "AGENTS" },
    ],
  },
  {
    group: "OBSERVE",
    items: [
      { to: "/", label: "Dashboard", icon: "grid", group: "OBSERVE" },
      { to: "/hive", label: "Hive", icon: "hexagon", group: "OBSERVE" },
      { to: "/executions", label: "Executions", icon: "list", group: "OBSERVE" },
      { to: "/build", label: "Build", icon: "hammer", group: "OBSERVE" },
      { to: "/analytics", label: "Analytics", icon: "chart", group: "OBSERVE" },
      { to: "/alerts", label: "Alerts", icon: "bell", group: "OBSERVE" },
      { to: "/quality", label: "Quality", icon: "gauge", group: "OBSERVE" },
      { to: "/infrastructure", label: "Infrastructure", icon: "server", group: "OBSERVE" },
      { to: "/security", label: "Security", icon: "shield", group: "OBSERVE" },
      { to: "/self-healing", label: "Self-Healing", icon: "refresh", group: "OBSERVE" },
      { to: "/memory", label: "Memory", icon: "brain", group: "OBSERVE" },
      { to: "/insights", label: "Insights", icon: "insights", group: "OBSERVE" },
      // "Mission Control" removed (WR-03): merged into Tasks — By Agent view
      // (phase 96 Plan 04, D-02). /mission-control still redirects to
      // /tasks?view=agent in App.tsx, so deep links keep working.
    ],
  },
  {
    group: "ACTIVITY",
    items: [
      { to: "/briefings", label: "Briefings", icon: "scroll", group: "ACTIVITY" },
      { to: "/automation", label: "Automation", icon: "clock", group: "ACTIVITY" },
      { to: "/ideation", label: "Ideation", icon: "idea", group: "ACTIVITY" },
      { to: "/dreaming", label: "Dreaming", icon: "moon", group: "ACTIVITY" },
      { to: "/channels/whatsapp", label: "WhatsApp", icon: "whatsapp", group: "ACTIVITY" },
      { to: "/war-room", label: "War Room", icon: "radio", group: "ACTIVITY" },
      { to: "/meeting-bot", label: "Meeting Bot", icon: "video", group: "ACTIVITY" },
    ],
  },
];

// Flat list of REAL routes (placeholders excluded, deduped by `to`) for
// CommandPalette and any other consumer of the nav registry.
export const navItems = (() => {
  const seen = new Set<string>();
  const flat: NavItem[] = [];
  for (const grp of navGroups) {
    for (const item of grp.items) {
      if (item.placeholder || !item.to) continue;
      if (seen.has(item.to)) continue;
      seen.add(item.to);
      flat.push(item);
    }
  }
  return flat;
})();
