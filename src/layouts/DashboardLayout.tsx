import { useState, useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useConvexConnectionState } from "convex/react";
import AlertBanner from "../components/AlertBanner";
import ErrorBoundary from "../components/ErrorBoundary";
import OnboardingGuide from "../components/OnboardingGuide";
import UserMenu from "../components/UserMenu";
import PrivacyShield from "../components/PrivacyShield";
import AmbientAudioPlayer from "../components/AmbientAudioPlayer";
import { useAudioEvents } from "../hooks/useAudioEvents";
import { Toaster } from "sonner";
import NotificationBell from "../components/NotificationBell";
import { useNotificationToasts } from "../hooks/useNotificationToasts";
import { EStopButton } from "../components/EStopButton";
import { CommandPalette } from "../components/CommandPalette";
import { NavBadge, NavBadgeDot } from "../components/NavBadge";
import { useNavCounts } from "../hooks/useNavCounts";
import { Separator } from "@/components/ui/separator";
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
  Sun,
  X,
  Menu,
  BookOpen,
  Wand2,
  UsersRound,
  ChevronsLeft,
  ChevronsRight,
  Grid3X3,
  Palette,
  Mail,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const iconComponents: Record<string, React.ElementType> = {
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
  "grid-3x3": Grid3X3,
  "palette": Palette,
  "mail": Mail,
};

const commandNavItems = [
  { to: "/chat", label: "Chat", icon: "message", group: "COMMAND" },
  { to: "/live-run", label: "Live Run", icon: "activity", group: "COMMAND" },
  { to: "/inbox", label: "Inbox", icon: "inbox", group: "COMMAND" },
  { to: "/tasks", label: "Tasks", icon: "kanban", group: "COMMAND" },
  { to: "/config", label: "Config", icon: "sliders", group: "COMMAND" },
  { to: "/transcripts", label: "Transcripts", icon: "scroll", group: "COMMAND" },
  { to: "/sessions", label: "Sessions", icon: "layout", group: "COMMAND" },
];

const agentsNavItems = [
  { to: "/hr/roster", label: "Roster", icon: "users", group: "AGENTS" },
  { to: "/hr/catalog", label: "Catalog", icon: "book-open", group: "AGENTS" },
  { to: "/hr/onboarding", label: "Onboarding", icon: "wand-2", group: "AGENTS" },
  { to: "/hr/teams", label: "Teams", icon: "users-round", group: "AGENTS" },
  { to: "/hr/analytics", label: "Analytics", icon: "chart", group: "AGENTS" },
];

const overviewNavItems = [
  { to: "/", label: "Dashboard", icon: "grid", group: "OVERVIEW" },
  { to: "/capabilities", label: "Capabilities", icon: "cpu", group: "OVERVIEW" },
  { to: "/analytics", label: "Analytics", icon: "chart", group: "OVERVIEW" },
  { to: "/alerts", label: "Alerts", icon: "bell", group: "OVERVIEW" },
  { to: "/infrastructure", label: "Infrastructure", icon: "server", group: "OVERVIEW" },
  { to: "/security", label: "Security", icon: "shield", group: "OVERVIEW" },
  { to: "/ideation", label: "Ideation", icon: "idea", group: "OVERVIEW" },
  { to: "/self-healing", label: "Self-Healing", icon: "refresh", group: "OVERVIEW" },
  { to: "/build", label: "Build", icon: "hammer", group: "OVERVIEW" },
  { to: "/memory", label: "Memory", icon: "brain", group: "OVERVIEW" },
  { to: "/dreaming", label: "Dreaming", icon: "moon", group: "OVERVIEW" },
  { to: "/briefings", label: "Briefings", icon: "scroll", group: "OVERVIEW" },
  { to: "/automation", label: "Automation", icon: "clock", group: "OVERVIEW" },
  { to: "/operations", label: "Operations", icon: "radio", group: "OVERVIEW" },
  { to: "/design-studio", label: "Design Studio", icon: "palette", group: "OVERVIEW" },
  { to: "/email-templates", label: "Email Templates", icon: "mail", group: "OVERVIEW" },
  { to: "/executions", label: "Executions", icon: "list", group: "OVERVIEW" },
  { to: "/settings", label: "Settings", icon: "gear", group: "OVERVIEW" },
  { to: "/insights", label: "Insights", icon: "insights", group: "OVERVIEW" },
  { to: "/channels/whatsapp", label: "WhatsApp", icon: "whatsapp", group: "OVERVIEW" },
  { to: "/war-room", label: "War Room", icon: "radio", group: "OVERVIEW" },
  { to: "/meeting-bot", label: "Meeting Bot", icon: "video", group: "OVERVIEW" },
  { to: "/mission-control", label: "Mission Control", icon: "layout", group: "OVERVIEW" },
  { to: "/tool-matrix", label: "Tool Matrix", icon: "grid-3x3", group: "OVERVIEW" },
];

// Keep navItems for any code that still references it
const navItems = [...commandNavItems, ...agentsNavItems, ...overviewNavItems];

function DarkModeToggle() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setDark(next);
  };
  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function NavGroup({
  label,
  items,
  onNavClick,
  collapsed,
  badgeCounts,
}: {
  label: string;
  items: typeof commandNavItems;
  onNavClick?: () => void;
  collapsed?: boolean;
  badgeCounts?: Record<string, number>;
}) {
  return (
    <>
      {!collapsed && (
        <p className="px-3 pt-4 pb-1 text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </p>
      )}
      {collapsed && <div className="pt-3" />}
      {items.map((item) => {
        const IconComponent = iconComponents[item.icon] ?? LayoutDashboard;
        const link = (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={onNavClick}
            aria-label={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center ${collapsed ? "justify-center px-2" : "gap-3 px-3"} py-2 text-sm transition-colors border-l-2 ${
                isActive
                  ? "bg-accent border-[var(--sidebar-active-bar)] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`
            }
          >
            {collapsed ? (
              <span className="relative">
                <IconComponent className="h-4 w-4 shrink-0" />
                {badgeCounts?.[item.to] ? <NavBadgeDot count={badgeCounts[item.to]} /> : null}
              </span>
            ) : (
              <IconComponent className="h-4 w-4 shrink-0" />
            )}
            {!collapsed && item.label}
            {!collapsed && badgeCounts?.[item.to] ? <NavBadge count={badgeCounts[item.to]} /> : null}
          </NavLink>
        );
        if (collapsed) {
          return (
            <Tooltip key={item.to}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        }
        return link;
      })}
    </>
  );
}

function SidebarContent({
  onNavClick,
  collapsed,
  onToggleCollapse,
}: {
  onNavClick?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const convexState = useConvexConnectionState();
  const isConnected = convexState.isWebSocketConnected;
  const dotColor = isConnected ? "bg-green-500" : "bg-yellow-500";
  const statusLabel = isConnected ? "Connected to Convex" : "Convex: reconnecting";
  const counts = useNavCounts();
  const badgeCounts: Record<string, number> = {
    "/alerts": counts.alerts,
    "/inbox": counts.inbox,
    "/tasks": counts.tasks,
  };

  return (
    <TooltipProvider delayDuration={200}>
      {/* Logo / Header */}
      <div className="p-4 border-b border-border">
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
          {collapsed ? (
            <div className="w-8 h-8 bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
              CP
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
                  CP
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-foreground">CodePulse</h1>
                  <p className="text-[10px] text-muted-foreground">Telemetry Dashboard</p>
                </div>
              </div>
              <DarkModeToggle />
            </>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2" aria-label="Main navigation">
        <NavGroup label="COMMAND" items={commandNavItems} onNavClick={onNavClick} collapsed={collapsed} badgeCounts={badgeCounts} />
        <Separator className="my-2 mx-3" />
        <NavGroup label="AGENTS" items={agentsNavItems} onNavClick={onNavClick} collapsed={collapsed} badgeCounts={badgeCounts} />
        <Separator className="my-2 mx-3" />
        <NavGroup label="OVERVIEW" items={overviewNavItems} onNavClick={onNavClick} collapsed={collapsed} badgeCounts={badgeCounts} />
      </nav>

      {/* Collapse Toggle + Connection Status */}
      <div className="border-t border-border">
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="w-full flex items-center justify-center py-2 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        )}
        <div className={`p-4 pt-2 flex items-center ${collapsed ? "justify-center" : "gap-2"}`}>
          <span className={`w-2 h-2 shrink-0 rounded-full ${dotColor}`} aria-hidden="true" />
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="sr-only">{statusLabel}</span>
              </TooltipTrigger>
              <TooltipContent side="right">{statusLabel}</TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-xs text-muted-foreground">{statusLabel}</span>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

function CrtToggle({
  crtEnabled,
  setCrtEnabled,
}: {
  crtEnabled: boolean;
  setCrtEnabled: (v: boolean) => void;
}) {
  const toggle = () => {
    const next = !crtEnabled;
    setCrtEnabled(next);
    localStorage.setItem("codepulse-crt", JSON.stringify(next));
    if (next) {
      document.body.classList.add("crt-active");
    } else {
      document.body.classList.remove("crt-active");
    }
    window.dispatchEvent(new Event("codepulse-crt-toggle"));
  };

  return (
    <button
      onClick={toggle}
      aria-label={crtEnabled ? "Disable CRT effect" : "Enable CRT effect"}
      title={crtEnabled ? "CRT effect ON — click to disable" : "CRT effect OFF — click to enable"}
      className={`p-1.5 transition-colors text-[10px] font-mono font-medium ${
        crtEnabled
          ? "bg-green-600/20 text-green-400 hover:bg-green-600/30"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      }`}
    >
      CRT
    </button>
  );
}

export default function DashboardLayout() {
  useAudioEvents();
  useNotificationToasts();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("codepulse-sidebar-collapsed") ?? "false");
    } catch {
      return false;
    }
  });
  const [paletteOpen, setPaletteOpen] = useState(false);

  const [crtEnabled, setCrtEnabled] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("codepulse-crt") ?? "false");
    } catch {
      return false;
    }
  });

  // Initialize dark mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      try {
        setCrtEnabled(JSON.parse(localStorage.getItem("codepulse-crt") ?? "false"));
      } catch {}
    };
    window.addEventListener("storage", handler);
    // Also listen for custom event for same-tab updates
    window.addEventListener("codepulse-crt-toggle", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("codepulse-crt-toggle", handler);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K: open command palette — allowed even from input fields (VS Code behavior)
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
        return;
      }

      // Don't trigger other shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case "m":
          // Toggle audio mute (dispatch event for AmbientAudioPlayer)
          window.dispatchEvent(new Event("codepulse-toggle-audio"));
          break;
        case "p":
          // Cycle privacy level
          window.dispatchEvent(new Event("codepulse-cycle-privacy"));
          break;
        case "escape":
          // Close mobile sidebar
          setSidebarOpen(false);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex ${sidebarCollapsed ? "w-[48px]" : "w-60"} flex-shrink-0 bg-sidebar dark:bg-[var(--glass-bg)] dark:backdrop-blur-[var(--glass-blur)] border-r border-border flex-col transition-[width] duration-200`}>
        <SidebarContent
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => {
            const next = !sidebarCollapsed;
            setSidebarCollapsed(next);
            localStorage.setItem("codepulse-sidebar-collapsed", JSON.stringify(next));
          }}
        />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-sidebar dark:bg-[var(--glass-bg)] dark:backdrop-blur-[var(--glass-blur)] border-r border-border flex flex-col transform transition-transform duration-200 md:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Close button */}
        <div className="absolute top-3 right-3">
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <SidebarContent onNavClick={() => setSidebarOpen(false)} />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-12 flex-shrink-0 bg-background border-b border-border flex items-center justify-between px-6">
          {/* Hamburger button - mobile only */}
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar menu"
            className="p-1 -ml-1 mr-3 text-muted-foreground hover:text-foreground transition-colors md:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
          <span className="text-sm text-muted-foreground">
            Astridr Runtime Telemetry
          </span>
          <div className="flex items-center gap-2">
            <EStopButton />
            <div className="w-px h-5 bg-border mx-1" />
            <NotificationBell />
            <PrivacyShield />
            <CrtToggle crtEnabled={crtEnabled} setCrtEnabled={setCrtEnabled} />
            <AmbientAudioPlayer />
            <div className="w-px h-5 bg-border mx-1" />
            <UserMenu />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-background p-6">
          <AlertBanner />
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* Onboarding Guide */}
      <OnboardingGuide />

      {/* CRT Overlay */}
      {crtEnabled && <div className="crt-overlay" />}

      {/* Toast Notifications */}
      <Toaster position="bottom-right" richColors visibleToasts={3} />

      {/* Global Command Palette — Cmd+K / Ctrl+K from any page */}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

// Export navItems for external use (CommandPalette, etc.)
export { navItems };
