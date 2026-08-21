import { useState, useEffect, useRef, lazy, Suspense, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { useConvexConnectionState } from "convex/react";
import AlertBanner from "../components/AlertBanner";
import ErrorBoundary from "../components/ErrorBoundary";
import OnboardingGuide from "../components/OnboardingGuide";
import UserMenu from "../components/UserMenu";
import PrivacyShield from "../components/PrivacyShield";
// DEBT-03 (plan 108-01): ThemeSwitcher is the entry chunk's only consumer of
// @radix-ui/react-select (42,988 bytes rendered). It is a header control, not a
// first-paint requirement — and critically the THEME itself is already applied
// before paint by the inline script in index.html, so deferring this defers the
// control only, never the colours. A fixed-size placeholder holds its slot so
// the header does not reflow when it arrives.
const ThemeSwitcher = lazy(() =>
  import("../components/ThemeSwitcher").then((m) => ({ default: m.ThemeSwitcher }))
);
import AmbientAudioPlayer from "../components/AmbientAudioPlayer";
import { useAudioEvents } from "../hooks/useAudioEvents";
import { Toaster } from "sonner";
import NotificationBell from "../components/NotificationBell";
import { useNotificationToasts } from "../hooks/useNotificationToasts";
import { EStopButton } from "../components/EStopButton";
// DEBT-03 (plan 108-01): CommandPalette is the entry chunk's only consumer of
// cmdk (14,920 bytes rendered). Nothing of it is visible until Ctrl+K opens it,
// and the hotkey listener lives in THIS file, not in the palette — so deferring
// the component cannot cost a keystroke. Kept mounted (rather than gated on
// paletteOpen) so its open/close animation and internal state behave exactly as
// before; only the chunk boundary moves.
const CommandPalette = lazy(() =>
  import("../components/CommandPalette").then((m) => ({ default: m.CommandPalette }))
);
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import { BrainHeaderBadge } from "../components/brains/BrainHeaderBadge";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// Phase 106 Plan 04 (DEBT-03): AvatarUploader pulls react-easy-crop (36,362
// bytes) and only ever renders inside the avatar dialog below, which is closed
// on every page load. A static import here put the cropper in the entry chunk
// for every visitor. Module-level lazy declaration, per CodeVaultGraph.tsx.
const AvatarUploader = lazy(() => import("../components/AvatarUploader"));
import LoadingState from "../components/LoadingState";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
// 103-18 (WR-01 gap closure): hoists GlobalSwapModal's mount lifetime above <Outlet/> so a route
// change (e.g. navigating away from /chat, whose BrainPicker composer pill is page-scoped) can
// never unmount the modal instance a "Revert global swap" toast action depends on — see
// GlobalSwapContext.tsx's own docstring for the full defect trail (WR-01, CR-03, CR-01, 103-14).
import { GlobalSwapProvider } from "@/contexts/GlobalSwapContext";
// Nav registry (navGroups/navItems/iconComponents) lives in a leaf module so
// CommandPalette can import it too without a DashboardLayout ↔ CommandPalette
// import cycle (WR-02, phase 96 review).
import { navGroups, iconComponents, type NavItem } from "@/lib/navRegistry";
// Phase 124 Plan 09 (SHELL-01, D-16): registry-derived breadcrumb, zone 1's
// replacement for the deleted "Astridr Runtime Telemetry" pill.
import { getBreadcrumbTrail } from "@/lib/breadcrumbs";
import {
  LayoutDashboard,
  Cpu,
  Server,
  Settings,
  X,
  Menu,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Ellipsis,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "../components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

// Phase 124 (SHELL-02, D-15): one localStorage key holding four per-domain
// open/closed booleans, keyed by the lowercase domain name from navGroups.
// Mirrors the sidebarCollapsed try/catch idiom below (kept the simpler
// init+on-toggle-write shape — no storage/custom-event listener, since no
// other surface reads this key, unlike codepulse-crt). The key string is
// repeated literally at the read and write call sites (not hoisted to a
// shared constant) to match that existing idiom exactly.
const DEFAULT_DOMAIN_OPEN_STATE: Record<string, boolean> = {
  command: true,
  observe: true,
  agents: true,
  system: true,
};

// Phase 124 (D-10/D-12/D-13): shared Data-typography classes for badge digits
// (12px JetBrains Mono, weight 600, tabular-nums) — applied directly on the
// base Badge below, and via a data-slot selector on the StatusBadge-composed
// alerts badge, since StatusBadge's own `text-sm font-medium` classes live on
// the same element and would otherwise win the specificity tie.
const BADGE_DATA_TYPE = "font-mono text-xs font-semibold tabular-nums";

// D-13: the dimmed neutral dot every shell-level badge boundary falls back
// to on a query throw — no colour spent (matches the Inbox pill's "no colour
// on a raw count" rule), carries the Copywriting Contract's accessible name
// verbatim, and never renders a number.
function BadgeUnavailableDot({ label }: { label: string }) {
  return (
    <span
      aria-label={label}
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40"
    />
  );
}

// D-10/D-12: Inbox's sidebar badge. A dedicated component (not a useQuery
// call inline in SidebarContent) so its own SectionErrorBoundary — added at
// its call site below — actually sits between this subscription and the rest
// of the sidebar; a throw during SidebarContent's own render would bubble
// past any boundary wrapping only a piece of its returned JSX (Task 3).
function InboxCountBadge() {
  // D-10 (amended 2026-08-21): listHeldUnacked — not the per-profile inbox
  // read (needs a profileId the shell doesn't have) or listAll (caps at 200
  // against 2,777 live rows). Counts unacked `held` rows only — 46 live at
  // planning time.
  const held = useQuery(api.inbox.listHeldUnacked);
  // D-12 state 1: unresolved -> nothing. `== null` also treats the mocked
  // `null` this repo's test suite uses for "not yet resolved" as unresolved
  // (Convex itself only ever returns `undefined` while loading; the mock
  // shape is test-only, per this task's own action text).
  if (held == null) return null;
  const count = held.length;
  if (count === 0) return null; // D-12 state 3: never a visible zero
  return (
    <Badge
      className={cn(
        "rounded-sm px-1.5 py-0",
        BADGE_DATA_TYPE,
        "bg-(--surface-3) text-(--foreground) border border-(--hairline)",
      )}
      aria-label={`${count} unread in Inbox`}
    >
      {count}
    </Badge>
  );
}

// D-10/D-12/D-13: Alerts' sidebar badge — severity-derived, matching the
// header system chip's worst-severity logic (124-07) so the two can never
// disagree, since both read the same `countBySeverity` subscription (Convex
// dedupes identical subscriptions client-side — one round trip, two
// consumers). `truncated` (124-03's ALERT_COUNT_SCAN_CAP) renders a trailing
// "+" and an "at least" accessible label rather than a complete-looking
// integer — the same honesty rule D-12 applies at the loading/zero end.
function AlertsCountBadge() {
  const counts = useQuery(api.alerts.countBySeverity);
  if (counts == null) return null; // D-12 state 1 (see InboxCountBadge's note on `== null`)
  const total = counts.info + counts.warning + counts.error + counts.critical;
  if (total === 0) return null; // D-12 state 3

  const displayLabel = counts.truncated ? `${total}+` : `${total}`;
  const a11yLabel = counts.truncated
    ? `at least ${total} unacknowledged alerts`
    : `${total} unacknowledged alerts`;

  if (counts.critical > 0 || counts.error > 0) {
    return (
      <span aria-label={a11yLabel} className="[&_[data-slot=badge]]:font-mono [&_[data-slot=badge]]:text-xs [&_[data-slot=badge]]:font-semibold [&_[data-slot=badge]]:tabular-nums">
        <StatusBadge status="error" tier="strong" label={displayLabel} />
      </span>
    );
  }
  if (counts.warning > 0) {
    return (
      <span aria-label={a11yLabel} className="[&_[data-slot=badge]]:font-mono [&_[data-slot=badge]]:text-xs [&_[data-slot=badge]]:font-semibold [&_[data-slot=badge]]:tabular-nums">
        <StatusBadge status="warn" tier="quiet" label={displayLabel} />
      </span>
    );
  }
  // Info-only: the same neutral pill as Inbox — no severity worth a colour.
  return (
    <Badge
      className={cn(
        "rounded-sm px-1.5 py-0",
        BADGE_DATA_TYPE,
        "bg-(--surface-3) text-(--foreground) border border-(--hairline)",
      )}
      aria-label={a11yLabel}
    >
      {displayLabel}
    </Badge>
  );
}

// D-11: the header's system chip — Nominal/Attention/Critical/Offline —
// composed entirely client-side from the SAME `alerts.countBySeverity`
// subscription AlertsCountBadge above reads (Convex dedupes the identical
// subscription client-side, so this costs no extra round trip) plus the
// connection flag SidebarContent already reads at its own call site
// (:308-309, the "122 D-16 precedent" 124-CONTEXT.md cites). `convex/health.ts`
// exports zero public queries (verified against `convex/alerts.ts` as a
// control, which does export public `query`s) — D-11's whole rationale for
// adding no backend rests on that absence, confirmed live rather than
// inherited from the plan. This is the fourth shell-level subscription to
// get its own SectionErrorBoundary (D-13) — Active Brain (pre-existing),
// Inbox count and Alerts count (124-06) were the first three; the plan text
// undercounts this as "the third", corrected here.
function SystemChip() {
  const { isWebSocketConnected } = useConvexConnectionState();
  const counts = useQuery(api.alerts.countBySeverity);

  // Resolution order, exactly (T-124-08-01). Offline wins over every
  // alert-derived state: once the socket is down the alert counts are stale
  // by definition, so reporting "Nominal" from them would be a confident
  // claim about data that is not arriving.
  if (!isWebSocketConnected) {
    return <StatusBadge status="idle" tier="quietest" label="Offline" />;
  }
  // D-12's undefined-preserving rule, one layer up: render NOTHING rather
  // than fabricate "Nominal" while the query has not resolved — the chip
  // appearing is itself the signal that a real reading exists. `== null`
  // also covers this suite's `null`-for-unresolved mock shape, matching
  // InboxCountBadge/AlertsCountBadge above.
  if (counts == null) return null;

  if (counts.critical > 0 || counts.error > 0) {
    return <StatusBadge status="error" tier="strong" label="Critical" />;
  }
  if (counts.warning > 0) {
    return <StatusBadge status="warn" tier="quiet" label="Attention" />;
  }
  // Nominal reads --status-ok via StatusBadge's "quiet" tier, never
  // --primary — the exact TOKEN-02 (Phase 122) collision this plan exists
  // to keep out of a brand-new component (healthy is not interactive).
  return <StatusBadge status="ok" tier="quiet" label="Nominal" />;
}

function NavGroup({
  label,
  items,
  onNavClick,
  collapsed,
  open,
  onOpenChange,
  badges,
}: {
  label: string;
  items: NavItem[];
  onNavClick?: () => void;
  collapsed?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // D-10: keyed by route `to` — only "/inbox" and "/alerts" ever have an
  // entry. Absent structurally at 48px: the `!collapsed &&` branch below is
  // the only place a badge renders, same as the label it sits beside.
  badges?: Record<string, ReactNode>;
}) {
  const itemList = (
    <div className="space-y-[1px]">
      {items.map((item) => {
        const IconComponent = iconComponents[item.icon] ?? LayoutDashboard;
        const badge = badges?.[item.to];

        const link = (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={onNavClick}
            aria-label={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `group flex items-center ${collapsed ? "justify-center px-2" : "gap-3 px-3"} py-2 text-[13px] leading-[1.4] font-normal transition-all relative overflow-hidden ${
                isActive
                  ? "is-active text-foreground bg-[color-mix(in_oklab,var(--primary)_6%,transparent)] before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-(--primary)"
                  : "text-muted-foreground hover:text-primary hover:bg-primary/5"
              }`
            }
          >
            <IconComponent className="h-4 w-4 shrink-0 transition-all duration-slow ease-house" />
            {!collapsed && (
              <>
                <span className="flex-1 min-w-0 truncate">{item.label}</span>
                {badge}
              </>
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
  );

  // D-14: at 48px the rail overrides per-domain state — headers render as
  // the existing icon-divider shape and every item renders regardless of
  // its domain's boolean. The boolean itself is untouched (held in memory
  // and localStorage), so restoring the rail restores whatever state was
  // already there.
  if (collapsed) {
    return (
      <div className="mb-2">
        <div className="pt-3" />
        {itemList}
      </div>
    );
  }

  return (
    <div className="mb-2">
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger className="group w-full flex items-center justify-between px-3 pt-4 pb-2">
          <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-normal ease-house group-data-[state=closed]:-rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent>{itemList}</CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function SidebarContent({
  onNavClick,
  collapsed,
  onToggleCollapse,
  domainOpen,
  onDomainOpenChange,
}: {
  onNavClick?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  domainOpen: Record<string, boolean>;
  onDomainOpenChange: (domainKey: string, open: boolean) => void;
}) {
  const convexState = useConvexConnectionState();
  const isConnected = convexState.isWebSocketConnected;
  const dotColor = isConnected ? "bg-(--status-ok)" : "bg-(--status-warn)";
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

  // D-10/D-13: Inbox and Alerts only, each wrapped in its own boundary — a
  // throw from one query never takes down the other or the rest of the
  // sidebar. Built once per SidebarContent instance (desktop + mobile drawer
  // each mount their own; Convex dedupes the identical underlying
  // subscriptions client-side, so this costs no extra round trip).
  const navBadges: Record<string, ReactNode> = {
    "/inbox": (
      <SectionErrorBoundary
        name="Inbox count"
        fallback={<BadgeUnavailableDot label="Inbox count unavailable" />}
      >
        <InboxCountBadge />
      </SectionErrorBoundary>
    ),
    "/alerts": (
      <SectionErrorBoundary
        name="Alerts count"
        fallback={<BadgeUnavailableDot label="Alerts count unavailable" />}
      >
        <AlertsCountBadge />
      </SectionErrorBoundary>
    ),
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
                      className="w-full h-full object-cover relative z-10 transition-opacity duration-slow ease-house"
                    />
                  )}
                  {/* Subtle scanline effect on hover */}
                  <div className="absolute inset-0 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-full h-[1px] bg-primary/40" />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    {/* D-03 (Phase 120): the glitch-effect class and its drop-shadow glow were
                        removed as a deliberate named exception to D-01 (POLISH-01's kill list).
                        font-mono tracking-wider is KEPT — the Geist sentence-case type treatment
                        is Phase 122/124's to change, not this plan's. shadow-primary is a
                        Tailwind shadow-color utility with no companion shadow-size class, so it
                        already renders nothing; left as-is and recorded in
                        120-SHELL-EVIDENCE.md for Phase 124. */}
                    <h1 className="text-base font-bold text-foreground font-mono tracking-wider shadow-primary">CodePulse</h1>
                  </div>
                  <div className="text-[11px] text-primary uppercase font-mono tracking-wider mt-0.5 flex items-start gap-1.5 leading-tight">
                    <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-primary shadow-[var(--glow-md)] mt-0.5" />
                    <span className="break-words">Operator: Larry Mandras</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Navigation — Phase 124 SHELL-02: 4 domains from navGroups config, each an
          independently collapsible section (D-14/D-15). */}
      <nav className="flex-1 overflow-y-auto py-2 px-2" aria-label="Main navigation">
        {navGroups.map((grp, i) => {
          const domainKey = grp.group.toLowerCase();
          return (
            <div key={grp.group}>
              {i > 0 && <Separator className="my-2 mx-3" />}
              <NavGroup
                label={grp.group}
                items={grp.items}
                onNavClick={onNavClick}
                collapsed={collapsed}
                open={domainOpen[domainKey] ?? true}
                onOpenChange={(next) => onDomainOpenChange(domainKey, next)}
                badges={navBadges}
              />
            </div>
          );
        })}
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
                      ? "is-active text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                  }`
                }
              >
                <Settings className="h-4 w-4 shrink-0 transition-all duration-slow ease-house group-[.is-active]:drop-shadow-[0_0_8px_oklch(from_var(--primary)_l_c_h_/_0.8)] group-hover:drop-shadow-[0_0_5px_oklch(from_var(--primary)_l_c_h_/_0.5)]" />
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
            <Suspense fallback={<LoadingState shape="text" />}>
              <AvatarUploader
                onUpload={handleAvatarUpload}
                onCancel={() => setIsAvatarUploadOpen(false)}
              />
            </Suspense>
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

  // Phase 124 (D-14/D-15): per-domain collapse state, lifted here (rather than
  // read independently inside each SidebarContent instance) so the desktop
  // <aside> and the mobile drawer <aside> — both mounted simultaneously —
  // never disagree about which domains are open. A toggle in either instance
  // updates this single object and both re-render from it.
  const [domainOpen, setDomainOpen] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("codepulse-nav-domains") ?? JSON.stringify(DEFAULT_DOMAIN_OPEN_STATE),
      );
    } catch {
      return DEFAULT_DOMAIN_OPEN_STATE;
    }
  });

  const handleDomainOpenChange = (domainKey: string, open: boolean) => {
    const next = { ...domainOpen, [domainKey]: open };
    setDomainOpen(next);
    localStorage.setItem("codepulse-nav-domains", JSON.stringify(next));
  };

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

  // Phase 124 Plan 09 (D-16): zone 1's breadcrumb, replacing the deleted
  // telemetry pill. Empty trail (unmapped/unmatched path) renders nothing —
  // never a guessed segment (breadcrumbs.ts's own contract).
  const location = useLocation();
  const breadcrumbTrail = getBreadcrumbTrail(location.pathname);

  // Voice lives on the Ástríðr presence page (/chat) — the wake-word engine,
  // mic toggle, and strict mode all moved there (2026-07-20). The shell is
  // voice-free; the palette is text-only.

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // A cmdk input (e.g. the Skills palette's vimBindings) may already have
      // consumed this keydown and called preventDefault — don't ALSO open the
      // global palette on top of it.
      if (e.defaultPrevented) return;

      // Cmd+K / Ctrl+K: open command palette — allowed even from input fields (VS Code behavior)
      if (e.key === "k" && !e.shiftKey && (e.metaKey || e.ctrlKey)) {
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
    // 103-18: wraps everything below, including <Outlet/> — the single app-level mount point for
    // GlobalSwapModal's route-surviving instance. Sits alongside BrainHeaderBadge in the header
    // cluster (both are descendants), not at the App.tsx/main.tsx root, because it only needs to
    // outlive route changes, not the whole app lifetime.
    <GlobalSwapProvider>
    <div className="flex h-screen overflow-hidden bg-background relative">
      {/* CRT Scanline Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden mix-blend-overlay">
        <div className="crt-scanline-bar w-full h-[5px] bg-primary/40 shadow-[var(--glow-md)]" />
      </div>
      
      {/* Sidebar Navigation */}
      <aside className={`hidden md:flex ${sidebarCollapsed ? "w-[48px]" : "w-[232px]"} flex-shrink-0 bg-sidebar dark:bg-[var(--glass-bg)] dark:backdrop-blur-[var(--glass-blur)] border-r border-border flex-col transition-[width] duration-normal ease-house`}>
        <SidebarContent
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => {
            const next = !sidebarCollapsed;
            setSidebarCollapsed(next);
            localStorage.setItem("codepulse-sidebar-collapsed", JSON.stringify(next));
          }}
          domainOpen={domainOpen}
          onDomainOpenChange={handleDomainOpenChange}
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
        className={`fixed inset-y-0 left-0 z-50 w-[232px] bg-sidebar dark:bg-[var(--glass-bg)] dark:backdrop-blur-[var(--glass-blur)] border-r border-border flex flex-col transform transition-transform duration-normal ease-house md:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Close button. 32x32px hit area (D-09/UI-SPEC Accessibility Contract):
            was p-1 (4px) + h-4 icon (16px) = 24x24; p-2 (8px each side) + the
            same 16px icon = 32x32. aria-label and click behavior unchanged. */}
        <div className="absolute top-3 right-3">
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <SidebarContent
          onNavClick={() => setSidebarOpen(false)}
          domainOpen={domainOpen}
          onDomainOpenChange={handleDomainOpenChange}
        />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/*
          Header — POLISH-06 (120-07). Measured live at 900px on /settings: none of the three
          row groups below (left cluster / search box / icon cluster) has a shrink guard, and
          none of them has `overflow` set, so each keeps its own content-driven minimum width
          (the flexbox automatic-minimum-size rule). Their combined min-content width (981px at
          900px viewport) exceeds the header's own available width (660px, correctly bounded
          because its flex-column PARENT already has `overflow-hidden`, which zeroes ITS
          automatic minimum size per the same rule). Because the header itself has no
          `overflow-hidden`, the excess previously rendered PAST the header's own box and was
          then invisibly clipped by a distant ancestor (line 517's `overflow-hidden`) — the icon
          cluster (E-Stop, brain badge, notification bell, etc.) was silently cut off rather than
          reachable at all, confirmed by walking every element under <body> (not just <main>; the
          plan's <main>-scoped walk alone found nothing, because this overflow originates in the
          shared header, present on every route, not in Settings' own content).
          `flex-wrap` lets the row drop to a second line instead of overflowing sideways when
          squeezed — every control stays fully rendered and within the viewport, at the cost of a
          taller header only when space is genuinely insufficient. `min-h-14` (was the fixed
          `h-14`) preserves today's exact 56px height whenever one row is enough; `gap-y-1` only
          adds space BETWEEN wrapped lines and is a no-op in the single-line case. No sidebar
          width, breakpoint literal, or Settings markup was touched — see 120-GEOMETRY-EVIDENCE.md
          for the revert-and-refail control proving this is load-bearing.
        */}
        <header className="min-h-14 flex-shrink-0 flex-wrap gap-y-1 bg-background/80 backdrop-blur-md border-b border-border flex items-center justify-between px-6 z-10 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div className="flex items-center gap-4">
            {/* Hamburger button - mobile only. 32x32px hit area (D-09/UI-SPEC
                Accessibility Contract): was p-1 (4px) + h-4 icon (16px) = 24x24,
                below the 32x32 WCAG 2.2 target with zero margin. p-2 (8px each
                side) + the same 16px icon = 32x32; -ml-2 (was -ml-1) keeps the
                icon's left edge visually aligned with the increased padding.
                aria-label and click behavior are unchanged. */}
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar menu"
              className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors md:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Zone 1 breadcrumb (D-16), >=md only — the hamburger above
                replaces it below md (D-09). Occupies the slot the deleted
                "Astridr Runtime Telemetry" pill used to hold (D-08: the pill
                was a decorative pulse dot + cyan-as-wallpaper, both already
                banned by POLISH-01). An empty trail (unmapped/unmatched path)
                renders nothing — no placeholder, no dash. */}
            {breadcrumbTrail.length > 0 && (
              <nav aria-label="Breadcrumb" className="hidden md:flex">
                <ol className="flex items-center gap-1.5">
                  {breadcrumbTrail.map((segment, i) => {
                    const isLast = i === breadcrumbTrail.length - 1;
                    return (
                      <li key={i} className="flex items-center gap-1.5">
                        {i > 0 && (
                          <span aria-hidden="true" className="text-muted-foreground">
                            /
                          </span>
                        )}
                        <span
                          aria-current={isLast ? "page" : undefined}
                          className={
                            isLast
                              ? "text-sm font-semibold text-foreground"
                              : "text-sm font-normal text-muted-foreground"
                          }
                        >
                          {segment}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </nav>
            )}
          </div>

          <div className="flex-1 max-w-[420px] mx-4 hidden md:flex">
            <button
              onClick={() => setPaletteOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground bg-muted/40 hover:bg-muted/60 hover:text-foreground rounded-md border border-border/50 transition-colors"
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
            <EStopButton />
            <SectionErrorBoundary name="Active Brain">
              <BrainHeaderBadge />
            </SectionErrorBoundary>
            {/* D-11/D-13: own boundary, own fallback — a throw from the alerts
                subscription or the connection hook must never blank the header.
                Collapses "disconnected" and "the alerts query errored" to the
                same dimmed dot per the UI-SPEC's Copywriting Contract, since the
                chip cannot distinguish them without backend work D-11 declines. */}
            <SectionErrorBoundary
              name="System status"
              fallback={<BadgeUnavailableDot label="System status unavailable" />}
            >
              <SystemChip />
            </SectionErrorBoundary>
            <NotificationBell />
            {/* Phase 124 (D-07, amended 2026-08-21): the four settings-shaped
                controls — theme, privacy, CRT, ambient audio — relocate here.
                Each keeps its own internal state/localStorage untouched; only
                the mount location moves. `size-8` (2rem = 32px) on the
                ghost/icon Button gives the trigger a 32x32px hit area. Plan
                124-09 brought the hamburger and mobile close-X up to the same
                32x32 target (they measured 24x24 when this comment was
                written), so all three icon-only controls in this file now
                clear it. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More options">
                  <Ellipsis className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <Suspense fallback={<div className="w-9 h-9" aria-hidden="true" />}>
                    <ThemeSwitcher />
                  </Suspense>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <PrivacyShield />
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <CrtToggle crtEnabled={crtEnabled} setCrtEnabled={setCrtEnabled} />
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <AmbientAudioPlayer />
                </DropdownMenuItem>
                {/* Phase 124 Plan 09 (D-08): SYS/LAT relocate here rather than
                    being deleted — they are real data (Phase 96 F3/D-04), not
                    decoration. DropdownMenuLabel (not DropdownMenuItem) keeps
                    them non-interactive read-only figures rather than a fifth
                    and sixth control in this menu — the load-bearing-facts
                    constraint on this plan is that the menu's control count
                    does not change. The same two booleans still gate them
                    exactly as before: a null systemResources.cpu or a disconnected WS
                    renders no row at all, never a "—", never a "0" (that
                    real-or-hidden contract is Phase 96's and this phase does
                    not reopen it). Data typography role: 12px (text-xs),
                    JetBrains Mono (font-mono), font-semibold, tabular-nums —
                    supersedes their prior font-bold (700), outside this
                    phase's two-weight budget. */}
                {(showSys || showLat) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="flex flex-col gap-1.5 font-normal">
                      {showSys && (
                        <span className="flex items-center gap-1.5 text-xs font-mono text-primary">
                          <Cpu className="w-3 h-3 text-primary" />
                          SYS:{" "}
                          <span className="text-primary font-semibold tabular-nums">
                            {Math.round(systemResources!.cpu!)}%
                          </span>
                        </span>
                      )}
                      {showLat && (
                        <span className="flex items-center gap-1.5 text-xs font-mono text-primary">
                          <Server className="w-3 h-3 text-primary" />
                          LAT:{" "}
                          <span className="text-primary font-semibold tabular-nums">
                            {headerLatencyMs}ms
                          </span>
                        </span>
                      )}
                    </DropdownMenuLabel>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
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

      {/* Global Command Palette — Cmd+K / Ctrl+K */}
      <Suspense fallback={null}>
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </Suspense>
    </div>
    </GlobalSwapProvider>
  );
}
