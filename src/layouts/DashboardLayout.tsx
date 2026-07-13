import { useState, useEffect, useRef } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useConvexConnectionState } from "convex/react";
import AlertBanner from "../components/AlertBanner";
import ErrorBoundary from "../components/ErrorBoundary";
import OnboardingGuide from "../components/OnboardingGuide";
import UserMenu from "../components/UserMenu";
import PrivacyShield from "../components/PrivacyShield";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import AmbientAudioPlayer from "../components/AmbientAudioPlayer";
import { useAudioEvents } from "../hooks/useAudioEvents";
import { Toaster } from "sonner";
import NotificationBell from "../components/NotificationBell";
import { useNotificationToasts } from "../hooks/useNotificationToasts";
import { EStopButton } from "../components/EStopButton";
import { CommandPalette } from "../components/CommandPalette";
import { MicToggle } from "../components/MicToggle";
import { ListeningIndicatorPill } from "../components/ListeningIndicatorPill";
import { useWakeWord } from "../hooks/useWakeWord";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AvatarUploader from "../components/AvatarUploader";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
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
  Search,
  MessageSquareText,
  Gauge,
} from "lucide-react";
import { ScrollArea } from "../components/ui/scroll-area";
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
  "message-square-text": MessageSquareText,
  gauge: Gauge,   // Phase 93 — Quality page
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
          <p className="text-xs uppercase tracking-widest text-primary/60 font-mono font-bold drop-shadow-[0_0_5px_oklch(from_var(--primary)_l_c_h_/_0.3)]">
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
                } py-2 text-sm font-mono tracking-wider text-muted-foreground/40 cursor-not-allowed select-none`}
              >
                <IconComponent className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <span className="flex-1 flex items-center justify-between gap-2">
                    {item.label}
                    <span className="text-[10px] uppercase tracking-widest text-primary/40 border border-primary/20 px-1 py-px rounded-sm">
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
                  <TooltipContent side="right" sideOffset={8} className="font-mono text-xs uppercase tracking-widest border-primary/30 bg-card text-muted-foreground">
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
                `group flex items-center ${collapsed ? "justify-center px-2" : "gap-3 px-3"} py-2 text-sm font-mono tracking-wider transition-all relative overflow-hidden ${
                  isActive
                    ? "is-active text-primary bg-primary/10 nav-active-shadow"
                    : "text-muted-foreground/80 hover:text-primary hover:bg-primary/5 nav-hover-shadow"
                }`
              }
            >
              <IconComponent
                className="h-4 w-4 shrink-0 transition-all duration-300 group-[.is-active]:drop-shadow-[0_0_8px_oklch(from_var(--primary)_l_c_h_/_0.8)] group-hover:drop-shadow-[0_0_5px_oklch(from_var(--primary)_l_c_h_/_0.5)]"
              />
              {!collapsed && (
                <span className="group-[.is-active]:drop-shadow-[0_0_5px_oklch(from_var(--primary)_l_c_h_/_0.4)]">
                  {item.label}
                </span>
              )}
            </NavLink>
          );
          if (collapsed) {
            return (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="font-mono text-xs uppercase tracking-widest border-primary/30 bg-card text-primary shadow-[var(--glow-sm)]">
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
            <div className="w-8 h-8 bg-primary flex items-center justify-center text-base font-bold text-primary-foreground">
              CP
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 w-full">
                {/* Avatar Slot */}
                <div
                  className="w-10 h-10 rounded-sm border-[1.5px] border-primary/50 overflow-hidden avatar-glow shrink-0 relative group cursor-pointer hover:border-primary transition-all"
                  onClick={() => setIsAvatarUploadOpen(true)}
                >
                  <div className="absolute inset-0 bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors pointer-events-none">
                    <span className="text-primary font-mono text-sm font-bold tracking-widest uppercase">LM</span>
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
                    <div className="w-full h-[1px] bg-primary/40" />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h1 className="text-base font-bold text-foreground font-mono tracking-wider shadow-primary drop-shadow-[0_0_8px_oklch(from_var(--primary)_l_c_h_/_0.5)] glitch-text" data-text="CodePulse">CodePulse</h1>
                  </div>
                  <div className="text-[11px] text-primary/80 uppercase font-mono tracking-wider mt-0.5 flex items-start gap-1.5 leading-tight">
                    <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-primary animate-pulse shadow-[var(--glow-md)] mt-0.5" />
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
                  `group flex items-center ${collapsed ? "justify-center px-2" : "gap-3 px-3"} py-2 text-sm font-mono tracking-wider transition-all relative overflow-hidden ${
                    isActive
                      ? "is-active text-primary bg-primary/10 nav-active-shadow"
                      : "text-muted-foreground/80 hover:text-primary hover:bg-primary/5 nav-hover-shadow"
                  }`
                }
              >
                <Settings className="h-4 w-4 shrink-0 transition-all duration-300 group-[.is-active]:drop-shadow-[0_0_8px_oklch(from_var(--primary)_l_c_h_/_0.8)] group-hover:drop-shadow-[0_0_5px_oklch(from_var(--primary)_l_c_h_/_0.5)]" />
                {!collapsed && <span>Settings</span>}
              </NavLink>
            );
            return collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>{settingsLink}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="font-mono text-xs uppercase tracking-widest border-primary/30 bg-card text-primary shadow-[var(--glow-sm)]">
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
            <span className="text-sm text-muted-foreground">{statusLabel}</span>
          )}
        </div>
      </div>

      <Dialog open={isAvatarUploadOpen} onOpenChange={setIsAvatarUploadOpen}>
        <DialogContent className="border border-primary/30 bg-card/95 backdrop-blur shadow-[var(--glow-sm)] sm:max-w-md">
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
      className={`p-1.5 transition-colors text-xs font-mono font-medium ${
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
  // Voice mode — whether the palette opened in voice mode (set by wake callback or cleared by ⌘K)
  const [voiceMode, setVoiceMode] = useState(false);

  // Persisted voice-mode-enabled toggle — OFF by default (D-06 / VOX-04)
  // Copied from the crtEnabled initializer pattern (lines 555-560)
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("codepulse-voice-mode") ?? "false");
    } catch {
      return false;
    }
  });

  const [crtEnabled, setCrtEnabled] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("codepulse-crt") ?? "false");
    } catch {
      return false;
    }
  });

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

  // Header telemetry (F3/D-04) — real CPU + WS round-trip latency, hidden
  // entirely when the underlying data is absent. Never fabricate a number.
  const systemResources = useQuery(api.systemResources.current);
  const showSys = systemResources?.cpu != null;

  const { status: wsStatus, sendCommand } = useAstridrWS();
  const [headerLatencyMs, setHeaderLatencyMs] = useState<number | null>(null);
  const headerPingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ping-based latency measurement — mirrors ConnectionPopover.tsx's 30s RTT
  // pattern. Only measures (and only renders) while the WS is connected.
  useEffect(() => {
    if (wsStatus !== "connected") {
      setHeaderLatencyMs(null);
      if (headerPingTimerRef.current) {
        clearInterval(headerPingTimerRef.current);
        headerPingTimerRef.current = null;
      }
      return;
    }

    const measureLatency = async () => {
      if (wsStatus !== "connected") return;
      try {
        const start = performance.now();
        await sendCommand({ type: "ping" }).catch(() => {
          /* error ack still gives RTT */
        });
        setHeaderLatencyMs(Math.round(performance.now() - start));
      } catch {
        // Ignore — latency stays at last known value
      }
    };

    void measureLatency();
    headerPingTimerRef.current = setInterval(() => {
      void measureLatency();
    }, 30_000);

    return () => {
      if (headerPingTimerRef.current) {
        clearInterval(headerPingTimerRef.current);
        headerPingTimerRef.current = null;
      }
    };
  }, [wsStatus, sendCommand]);

  const showLat = wsStatus === "connected" && headerLatencyMs != null;

  // Wake-word engine — onWake opens the command palette in voice mode (VOX-01)
  const {
    status: wakeWordStatus,
    errorReason: wakeWordErrorReason,
    start: wakeWordStart,
    stop: wakeWordStop,
  } = useWakeWord({
    baseUrl: '/openwakeword',
    onWake: () => {
      setPaletteOpen(true);
      setVoiceMode(true);
    },
  });

  // Drive mic start/stop from the persisted toggle (VOX-04 — no mic unless explicitly enabled).
  // Start only from a clean 'idle' state. Critically, do NOT call stop() on 'error-disabled':
  // stop() resets status to 'idle', which re-triggers start() → fail → error-disabled → idle …
  // an infinite retry storm. On error we leave the engine disabled until the user toggles off
  // (which resets to idle) and back on. Recovery: turn the mic off, then on again.
  useEffect(() => {
    if (!voiceModeEnabled) {
      wakeWordStop();
    } else if (wakeWordStatus === 'idle') {
      void wakeWordStart();
    }
    // loading / ready / error-disabled while enabled → do nothing (no auto-retry).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceModeEnabled, wakeWordStatus]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K: open command palette in text mode — allowed even from input fields (VS Code behavior)
      // Voice mode is NOT set here — ⌘K always opens text mode (VOX-01 criterion: coexist with wake)
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setVoiceMode(false);
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
        <div className="crt-scanline-bar w-full h-[5px] bg-primary/40 shadow-[var(--glow-md)]" />
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
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded bg-primary/10 border border-primary/20 shadow-[var(--glow-xs)]">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[var(--glow-md)]" />
                <span className="text-xs font-mono tracking-widest text-primary uppercase">
                  Astridr Runtime Telemetry
                </span>
              </div>
              
              {(showSys || showLat) && (
                <div className="hidden lg:flex items-center gap-4 text-xs font-mono text-primary/60 pl-2 border-l border-primary/20">
                  {showSys && (
                    <span className="flex items-center gap-1.5">
                      <Cpu className="w-3 h-3 text-primary/80" />
                      SYS: <span className="text-primary font-bold">{Math.round(systemResources!.cpu!)}%</span>
                    </span>
                  )}
                  {showLat && (
                    <span className="flex items-center gap-1.5">
                      <Server className="w-3 h-3 text-primary/80" />
                      LAT: <span className="text-primary font-bold">{headerLatencyMs}ms</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 max-w-sm mx-4 hidden md:flex">
            <button
              onClick={() => setPaletteOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground bg-accent/50 hover:bg-accent hover:text-foreground rounded-md border border-border/50 transition-colors"
            >
              <Search className="w-4 h-4" />
              <span className="flex-1 text-left">Search / Command...</span>
              <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium opacity-100">
                <span className="text-xs">⌘</span>K
              </kbd>
            </button>
          </div>

          <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-1.5 sm:gap-2 bg-primary/5 px-2 py-1.5 rounded-md border border-primary/10">
            {/* Voice mode controls — ListeningIndicatorPill only when engine is ready and voice is ON */}
            {voiceModeEnabled && wakeWordStatus === 'ready' && <ListeningIndicatorPill />}
            <MicToggle
              enabled={voiceModeEnabled}
              status={wakeWordStatus}
              errorReason={wakeWordErrorReason}
              onToggle={(v) => {
                setVoiceModeEnabled(v);
                localStorage.setItem('codepulse-voice-mode', JSON.stringify(v));
              }}
            />
            <EStopButton />
            <div className="w-px h-4 bg-primary/20 mx-1" />
            <NotificationBell />
            <PrivacyShield />
            <ThemeSwitcher />
            <CrtToggle crtEnabled={crtEnabled} setCrtEnabled={setCrtEnabled} />
            <AmbientAudioPlayer />
            <div className="w-px h-4 bg-primary/20 mx-1" />
            <UserMenu />
          </div>
          </TooltipProvider>
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

      {/* Toast Notifications */}
      <Toaster position="bottom-right" richColors visibleToasts={3} />

      {/* Global Command Palette — Cmd+K / Ctrl+K (text mode) or wake-word (voice mode) */}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={(open) => {
          setPaletteOpen(open);
          if (!open) setVoiceMode(false);
        }}
        voiceMode={voiceMode}
        voiceState={voiceMode ? 'listening' : undefined}
        onVoiceClose={() => {
          setVoiceMode(false);
          setPaletteOpen(false);
        }}
      />
    </div>
  );
}

// Export navItems for external use (CommandPalette, etc.)
export { navItems };
// Export iconComponents so CommandPalette can resolve string-keyed icons (F2 enabler, Plan 05)
export { iconComponents };
