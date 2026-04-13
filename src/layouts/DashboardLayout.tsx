import { useState, useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { ConnectionPopover } from "@/components/ConnectionPopover";
import {
  LayoutDashboard, BarChart2, Bot, List, Hammer, Clock,
  Server, Shield, RefreshCw, Brain, Cpu, ScrollText, Bell,
  Users, Settings2, ChevronLeft, ChevronRight, Menu, X,
  MessageSquare, Activity, Inbox, Kanban, SlidersHorizontal,
  Lightbulb,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
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
import { useNavCounts } from "../hooks/useNavCounts";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  countKey?: keyof ReturnType<typeof useNavCounts>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "COMMAND",
    items: [
      { to: "/chat", label: "Chat", icon: MessageSquare },
      { to: "/live-run", label: "Live Run", icon: Activity },
      { to: "/inbox", label: "Inbox", icon: Inbox },
      { to: "/tasks", label: "Tasks", icon: Kanban },
      { to: "/config", label: "Config", icon: SlidersHorizontal },
    ],
  },
  {
    label: "OVERVIEW",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, countKey: "activeSessions" },
      { to: "/analytics", label: "Analytics", icon: BarChart2 },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { to: "/agents", label: "Agents", icon: Bot, countKey: "activeAgents" },
      { to: "/executions", label: "Executions", icon: List, countKey: "recentExecutions" },
      { to: "/build", label: "Build", icon: Hammer, countKey: "activeBuildJobs" },
      { to: "/automation", label: "Automation", icon: Clock, countKey: "automationJobs" },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { to: "/infrastructure", label: "Infrastructure", icon: Server },
      { to: "/security", label: "Security", icon: Shield, countKey: "securityEvents" },
      { to: "/self-healing", label: "Self-Healing", icon: RefreshCw },
      { to: "/memory", label: "Memory", icon: Brain, countKey: "memoryEntries" },
    ],
  },
  {
    label: "INSIGHTS",
    items: [
      { to: "/capabilities", label: "Capabilities", icon: Cpu, countKey: "capabilities" },
      { to: "/briefings", label: "Briefings", icon: ScrollText, countKey: "briefings" },
      { to: "/alerts", label: "Alerts", icon: Bell, countKey: "unreadAlerts" },
      { to: "/ideation", label: "Ideation", icon: Lightbulb },
      { to: "/profiles", label: "Profiles", icon: Users },
    ],
  },
  {
    label: "ADMIN",
    items: [
      { to: "/settings", label: "Settings", icon: Settings2 },
    ],
  },
];

function SidebarContent({
  collapsed,
  onNavClick,
}: {
  collapsed: boolean;
  onNavClick?: () => void;
}) {
  const { status: wsStatus } = useAstridrWS();
  const counts = useNavCounts();

  return (
    <>
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary flex items-center justify-center text-sm font-semibold text-primary-foreground shrink-0">
            CP
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-sm font-semibold">CodePulse</h1>
              <p className="text-xs text-muted-foreground">Telemetry Dashboard</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2" aria-label="Main navigation">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-3 pt-4 pb-1">
                {group.label}
              </p>
            )}
            {collapsed && <div className="pt-3" />}
            {group.items.map((item) => {
              const Icon = item.icon;
              const count = item.countKey ? counts[item.countKey] : 0;
              const showBadge = item.countKey && count > 0;

              const link = (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={onNavClick}
                  aria-label={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 min-h-[44px] text-sm transition-colors ${
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    } ${collapsed ? "justify-center px-0" : ""}`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {showBadge && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {count}
                        </Badge>
                      )}
                    </>
                  )}
                </NavLink>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }

              return link;
            })}
          </div>
        ))}
      </nav>

      {/* Connection Status — D-08, D-09 */}
      <div className="p-4 border-t border-border">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="flex justify-center cursor-default"
                aria-label={`WebSocket ${wsStatus}`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    wsStatus === "connected"
                      ? "bg-(--status-ok)"
                      : wsStatus === "reconnecting"
                        ? "bg-(--status-warn) animate-pulse"
                        : "bg-(--status-error)"
                  }`}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              {wsStatus === "connected"
                ? "Connected"
                : wsStatus === "reconnecting"
                  ? "Reconnecting..."
                  : "Disconnected"}
            </TooltipContent>
          </Tooltip>
        ) : (
          <ConnectionPopover />
        )}
      </div>
    </>
  );
}

export default function DashboardLayout() {
  useAudioEvents();
  useNotificationToasts();
  const { status: wsStatus } = useAstridrWS();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case "m":
          window.dispatchEvent(new Event("codepulse-toggle-audio"));
          break;
        case "p":
          window.dispatchEvent(new Event("codepulse-cycle-privacy"));
          break;
        case "escape":
          setSidebarOpen(false);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Desktop Sidebar */}
        <aside
          className={`hidden md:flex flex-shrink-0 bg-background border-r border-border flex-col transition-[width] duration-200 ${
            collapsed ? "w-12" : "w-60"
          }`}
        >
          <SidebarContent collapsed={collapsed} />
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="p-2 border-t border-border text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
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
          className={`fixed inset-y-0 left-0 z-50 w-60 bg-background border-r border-border flex flex-col transform transition-transform duration-200 md:hidden ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="absolute top-3 right-3">
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <SidebarContent collapsed={false} onNavClick={() => setSidebarOpen(false)} />
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="h-12 flex-shrink-0 bg-background border-b border-border flex items-center justify-between px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar menu"
              className="p-1 -ml-1 mr-3 text-muted-foreground hover:text-foreground transition-colors md:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm text-muted-foreground">
              Astridr Runtime Telemetry
            </span>
            <div className="flex items-center gap-2">
              {/* WS status dot — D-08 (header placement) */}
              <div aria-label={`Astridr connection: ${wsStatus}`}>
                <div
                  className={`w-2 h-2 rounded-full ${
                    wsStatus === "connected"
                      ? "bg-(--status-ok)"
                      : wsStatus === "reconnecting"
                        ? "bg-(--status-warn) animate-pulse"
                        : "bg-(--status-error)"
                  }`}
                />
              </div>
              <EStopButton />
              <div className="w-px h-5 bg-border mx-1" />
              <NotificationBell />
              <PrivacyShield />
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

        {/* Toast Notifications */}
        <Toaster position="bottom-right" richColors visibleToasts={3} />
      </div>
    </TooltipProvider>
  );
}
