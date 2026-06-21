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
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AvatarUploader from "../components/AvatarUploader";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
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
  Terminal,
  Network,
  Boxes,
  Share2,
  Flame,
  Hexagon,
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
  // Phase 71 IA refactor — new cluster icons
  terminal: Terminal,
  network: Network,
  boxes: Boxes,
  "share-2": Share2,
  flame: Flame,
  hexagon: Hexagon,   // Phase 149 — Hive page
};

// A nav item is either a real route (has `to`) or a placeholder label for a
// not-yet-built route (`placeholder: true`, no live `to`). Placeholders render
// as disabled "soon" entries and are EXCLUDED from the flat navItems export.
interface NavItem {
  to?: string;
  label: string;
  icon: string;
  group: string;
  placeholder?: boolean;
}

interface NavGroupConfig {
  group: string;
  items: NavItem[];
}

// Phase 71 IA refactor — 6 clusters. No existing `to` path changed; new phase
// routes are registered as placeholder labels only (Settings stays in the
// footer UserMenu, not a nav cluster).
const navGroups: NavGroupConfig[] = [
  {
    group: "COMMAND",
    items: [
      { to: "/chat", label: "Chat", icon: "message", group: "COMMAND" },
      { to: "/live-run", label: "Live Run", icon: "activity", group: "COMMAND" },
      { to: "/inbox", label: "Inbox", icon: "inbox", group: "COMMAND" },
      { to: "/tasks", label: "Tasks", icon: "kanban", group: "COMMAND" },
      { to: "/config", label: "Config", icon: "sliders", group: "COMMAND" },
      { to: "/skills", label: "Skills", icon: "wand-2", group: "COMMAND" },
    ],
  },
  {
    group: "CONSOLE",
    items: [
      { label: "Agent Console", icon: "terminal", group: "CONSOLE", placeholder: true },
      { to: "/live-run", label: "Live Run", icon: "activity", group: "CONSOLE" },
      { to: "/executions", label: "Executions", icon: "list", group: "CONSOLE" },
      { to: "/build", label: "Build", icon: "hammer", group: "CONSOLE" },
      { to: "/forge", label: "Forge", icon: "flame", group: "CONSOLE" },
    ],
  },
  {
    group: "GRAPHS",
    items: [
      { label: "Graphs Hub", icon: "network", group: "GRAPHS", placeholder: true },
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
      { to: "/analytics", label: "Analytics", icon: "chart", group: "OBSERVE" },
      { to: "/alerts", label: "Alerts", icon: "bell", group: "OBSERVE" },
      { to: "/infrastructure", label: "Infrastructure", icon: "server", group: "OBSERVE" },
      { to: "/security", label: "Security", icon: "shield", group: "OBSERVE" },
      { to: "/self-healing", label: "Self-Healing", icon: "refresh", group: "OBSERVE" },
      { to: "/memory", label: "Memory", icon: "brain", group: "OBSERVE" },
      { to: "/insights", label: "Insights", icon: "insights", group: "OBSERVE" },
      { to: "/mission-control", label: "Mission Control", icon: "layout", group: "OBSERVE" },
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
// CommandPalette and any other consumer of the nav registry. Preserved export.
const navItems = (() => {
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
}: {
  label: string;
  items: NavItem[];
  onNavClick?: () => void;
  collapsed?: boolean;
}) {
  return (
    <div className="mb-2">
      {!collapsed && (
        <div className="px-3 pt-4 pb-2 flex items-center gap-2">
          <span className="w-1 h-1 rounded-full bg-primary/50 animate-pulse" />
          <p className="text-[10px] uppercase tracking-widest text-primary/60 font-mono font-bold drop-shadow-[0_0_5px_rgba(16,185,129,0.3)]">
            {label}
          </p>
        </div>
      )}
      {collapsed && <div className="pt-3" />}
      <div className="space-y-[1px]">
        {items.map((item) => {
          const IconComponent = iconComponents[item.icon] ?? LayoutDashboard;

          // Placeholder: not-yet-built route. Render as a disabled, non-link
          // entry with a "SOON" affordance instead of a NavLink (no 404).
          if (item.placeholder || !item.to) {
            const placeholderInner = (
              <div
                key={`ph-${item.group}-${item.label}`}
                aria-disabled="true"
                title={collapsed ? `${item.label} (coming soon)` : undefined}
                className={`group flex items-center ${
                  collapsed ? "justify-center px-2" : "gap-3 px-3"
                } py-2 text-xs font-mono tracking-wider text-muted-foreground/40 cursor-not-allowed select-none`}
              >
                <IconComponent className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <span className="flex-1 flex items-center justify-between gap-2">
                    {item.label}
                    <span className="text-[8px] uppercase tracking-widest text-primary/40 border border-primary/20 px-1 py-px rounded-sm">
                      soon
                    </span>
                  </span>
                )}
              </div>
            );
            if (collapsed) {
              return (
                <Tooltip key={`ph-${item.group}-${item.label}`}>
                  <TooltipTrigger asChild>{placeholderInner}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8} className="font-mono text-[10px] uppercase tracking-widest border-primary/30 bg-card text-muted-foreground">
                    {item.label} — soon
                  </TooltipContent>
                </Tooltip>
              );
            }
            return placeholderInner;
          }

          const link = (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={onNavClick}
              aria-label={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `group flex items-center ${collapsed ? "justify-center px-2" : "gap-3 px-3"} py-2 text-xs font-mono tracking-wider transition-all relative overflow-hidden ${
                  isActive
                    ? "is-active text-primary bg-primary/10 shadow-[inset_2px_0_15px_rgba(16,185,129,0.15),inset_3px_0_0_rgba(16,185,129,1)]"
                    : "text-muted-foreground/80 hover:text-primary hover:bg-primary/5 hover:shadow-[inset_2px_0_10px_rgba(16,185,129,0.1),inset_3px_0_0_rgba(16,185,129,0.5)]"
                }`
              }
            >
              <IconComponent 
                className="h-4 w-4 shrink-0 transition-all duration-300 group-[.is-active]:drop-shadow-[0_0_8px_rgba(16,185,129,0.8)] group-hover:drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]"
              />
              {!collapsed && (
                <span className="group-[.is-active]:drop-shadow-[0_0_5px_rgba(16,185,129,0.4)]">
                  {item.label}
                </span>
              )}
            </NavLink>
          );
          if (collapsed) {
            return (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="font-mono text-[10px] uppercase tracking-widest border-primary/30 bg-card text-primary shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }
          return link;
        })}
      </div>
    </div>
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

  const [isAvatarUploadOpen, setIsAvatarUploadOpen] = useState(false);
  const [avatarStorageId, setAvatarStorageId] = useState<string | null>(() => 
    localStorage.getItem("userAvatarStorageId")
  );

  const avatarUrl = useQuery(
    api.avatars.getImageUrl,
    avatarStorageId ? { storageId: avatarStorageId as Id<"_storage"> } : "skip"
  );

  const handleAvatarUpload = (storageId: string) => {
    localStorage.setItem("userAvatarStorageId", storageId);
    setAvatarStorageId(storageId);
    setIsAvatarUploadOpen(false);
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
              <div className="flex items-center gap-3 w-full">
                {/* Avatar Slot */}
                <div 
                  className="w-10 h-10 rounded-sm border-[1.5px] border-primary/50 overflow-hidden shadow-[0_0_10px_rgba(16,185,129,0.3)] shrink-0 relative group cursor-pointer hover:border-primary transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.6)]"
                  onClick={() => setIsAvatarUploadOpen(true)}
                >
                  <div className="absolute inset-0 bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors pointer-events-none">
                    <span className="text-primary font-mono text-[11px] font-bold tracking-widest uppercase">LM</span>
                  </div>
                  {avatarUrl && (
                    <img 
                      src={avatarUrl} 
                      alt="Larry Mandras" 
                      className="w-full h-full object-cover relative z-10 transition-opacity duration-300" 
                    />
                  )}
                  {/* Subtle scanline effect on hover */}
                  <div className="absolute inset-0 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-full h-[1px] bg-primary/40 animate-scanline" />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h1 className="text-sm font-bold text-foreground font-mono tracking-wider shadow-primary drop-shadow-[0_0_8px_rgba(16,185,129,0.5)] glitch-text" data-text="CodePulse">CodePulse</h1>
                    <DarkModeToggle />
                  </div>
                  <div className="text-[9px] text-primary/80 uppercase font-mono tracking-wider mt-0.5 flex items-start gap-1.5 leading-tight">
                    <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)] mt-0.5" />
                    <span className="break-words">Operator: Larry Mandras</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Navigation — Phase 71 IA: 6 clusters from navGroups config */}
      <nav className="flex-1 overflow-y-auto py-2 px-2" aria-label="Main navigation">
        {navGroups.map((grp, i) => (
          <div key={grp.group}>
            {i > 0 && <Separator className="my-2 mx-3" />}
            <NavGroup label={grp.group} items={grp.items} onNavClick={onNavClick} collapsed={collapsed} />
          </div>
        ))}
      </nav>

      {/* Footer-pinned Settings (not a nav cluster) + Collapse Toggle + Status */}
      <div className="border-t border-border">
        <div className="px-2 pt-2">
          {(() => {
            const settingsLink = (
              <NavLink
                to="/settings"
                onClick={onNavClick}
                aria-label={collapsed ? "Settings" : undefined}
                className={({ isActive }) =>
                  `group flex items-center ${collapsed ? "justify-center px-2" : "gap-3 px-3"} py-2 text-xs font-mono tracking-wider transition-all relative overflow-hidden ${
                    isActive
                      ? "is-active text-primary bg-primary/10 shadow-[inset_2px_0_15px_rgba(16,185,129,0.15),inset_3px_0_0_rgba(16,185,129,1)]"
                      : "text-muted-foreground/80 hover:text-primary hover:bg-primary/5 hover:shadow-[inset_2px_0_10px_rgba(16,185,129,0.1),inset_3px_0_0_rgba(16,185,129,0.5)]"
                  }`
                }
              >
                <Settings className="h-4 w-4 shrink-0 transition-all duration-300 group-[.is-active]:drop-shadow-[0_0_8px_rgba(16,185,129,0.8)] group-hover:drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                {!collapsed && <span>Settings</span>}
              </NavLink>
            );
            return collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>{settingsLink}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="font-mono text-[10px] uppercase tracking-widest border-primary/30 bg-card text-primary shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                  Settings
                </TooltipContent>
              </Tooltip>
            ) : (
              settingsLink
            );
          })()}
        </div>
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

      <Dialog open={isAvatarUploadOpen} onOpenChange={setIsAvatarUploadOpen}>
        <DialogContent className="border border-primary/30 bg-card/95 backdrop-blur shadow-[0_0_40px_rgba(16,185,129,0.15)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-primary font-mono uppercase tracking-widest">Update Operator Avatar</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <AvatarUploader 
              onUpload={handleAvatarUpload} 
              onCancel={() => setIsAvatarUploadOpen(false)} 
            />
          </div>
        </DialogContent>
      </Dialog>
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
    <div className="flex h-screen overflow-hidden bg-background relative">
      <div className="matrix-bg" />
      {/* CRT Scanline Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden mix-blend-overlay">
        <div className="w-full h-[5px] bg-primary/40 animate-scanline shadow-[0_0_20px_rgba(16,185,129,0.8)]" />
      </div>
      
      {/* Sidebar Navigation */}
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
        <header className="h-14 flex-shrink-0 bg-background/80 backdrop-blur-md border-b border-border flex items-center justify-between px-6 z-10 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div className="flex items-center gap-4">
            {/* Hamburger button - mobile only */}
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar menu"
              className="p-1 -ml-1 text-muted-foreground hover:text-foreground transition-colors md:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded bg-primary/10 border border-primary/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                <span className="text-[10px] font-mono tracking-widest text-primary uppercase">
                  Astridr Runtime Telemetry
                </span>
              </div>
              
              <div className="hidden lg:flex items-center gap-4 text-[10px] font-mono text-primary/60 pl-2 border-l border-primary/20">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3 h-3 text-primary/80" /> 
                  SYS: <span className="text-primary font-bold">14%</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Server className="w-3 h-3 text-primary/80" /> 
                  LAT: <span className="text-primary font-bold">12ms</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 bg-primary/5 px-2 py-1.5 rounded-md border border-primary/10">
            <EStopButton />
            <div className="w-px h-4 bg-primary/20 mx-1" />
            <NotificationBell />
            <PrivacyShield />
            <CrtToggle crtEnabled={crtEnabled} setCrtEnabled={setCrtEnabled} />
            <AmbientAudioPlayer />
            <div className="w-px h-4 bg-primary/20 mx-1" />
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
