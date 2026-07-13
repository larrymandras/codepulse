import { useState, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useSecurityEventsPaginated } from "../hooks/useSecurityEvents";
import { useAstridrWS } from "../contexts/AstridrWSContext";
import { Skeleton } from "@/components/ui/skeleton";
import { useLiveFlash } from "../hooks/useLiveFlash";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import SecurityStats from "../components/SecurityStats";
import SecurityEventFeed from "../components/SecurityEventFeed";
import InfoTooltip from "../components/InfoTooltip";
import LoadMoreButton from "../components/LoadMoreButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StatusBadge from "../components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";

const SEVERITY_TABS = ["all", "critical", "high", "medium", "low"] as const;
type SeverityFilter = (typeof SEVERITY_TABS)[number];

function formatRelativeTime(epochSeconds: number | null): string {
  if (!epochSeconds) return "--";
  const now = Date.now() / 1000;
  const diff = now - epochSeconds;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatTimestamp(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleString();
}

function statusColor(value: number, thresholds: { warn: number; danger: number }): string {
  if (value >= thresholds.danger) return "text-red-400";
  if (value >= thresholds.warn) return "text-yellow-400";
  return "text-green-400";
}

type WsSecurityEvent = {
  id: string;
  type: string;
  description: string;
  severity: string;
  timestamp: number;
};

export default function Security() {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [wsEvents, setWsEvents] = useState<WsSecurityEvent[]>([]);
  const { subscribeEvent } = useAstridrWS();
  const { flashRef, triggerFlash } = useLiveFlash();

  const { events: convexEvents, status: securityStatus, loadMore: loadMoreSecurity } = useSecurityEventsPaginated();

  // Merge WS events (prepended) with Convex events
  const mergedEvents = [...wsEvents, ...convexEvents];

  const filteredEvents =
    severityFilter === "all"
      ? mergedEvents
      : mergedEvents.filter((e: any) => e.severity === severityFilter);

  const rlsStats = useQuery(api.security.rlsStats);
  const hitlStats = useQuery(api.security.hitlStats);
  const webhookStats = useQuery(api.security.webhookStats);
  const vaultStats = useQuery(api.security.vaultStats);
  const sandboxOverview = useQuery(api.sandboxViolations.overview);
  const recentViolations = useQuery(api.sandboxViolations.recent, { limit: 20 });

  // All security events for Browser Guard and Network Policy tabs
  const allSecEvents = useQuery(api.security.recentEvents);

  // Browser Guard: filter events by browser_guard type or category
  const browserGuardEvents = useMemo(
    () =>
      (allSecEvents ?? []).filter(
        (e: any) =>
          e.eventType === "browser_guard_block" ||
          e.eventType === "browser_guard_allow" ||
          e.category === "browser_guard"
      ),
    [allSecEvents]
  );
  const bgBlocked = useMemo(
    () => browserGuardEvents.filter((e: any) => e.eventType === "browser_guard_block").length,
    [browserGuardEvents]
  );
  const bgAllowed = useMemo(
    () => browserGuardEvents.filter((e: any) => e.eventType === "browser_guard_allow").length,
    [browserGuardEvents]
  );

  // Network Policy: filter events related to network policy
  const networkPolicyEvents = useMemo(
    () =>
      (allSecEvents ?? []).filter(
        (e: any) =>
          e.eventType === "network_policy_block" ||
          e.eventType === "network_policy_allow" ||
          e.category === "network_policy"
      ),
    [allSecEvents]
  );

  // WS: prepend new security events
  useEffect(() => {
    const unsubSecurity = subscribeEvent("security_event", (event) => {
      const data = event.data as Record<string, unknown> | undefined;
      if (!data) return;
      const wsEvent: WsSecurityEvent = {
        id: (data.id as string | undefined) ?? crypto.randomUUID(),
        type: (data.event_type as string | undefined) ?? "security_event",
        description: (data.description as string | undefined) ?? "",
        severity: (data.severity as string | undefined) ?? "low",
        timestamp: typeof data.timestamp === "number" ? data.timestamp : Date.now() / 1000,
      };
      setWsEvents((prev) => {
        if (prev.some((e) => e.id === wsEvent.id)) return prev;
        return [wsEvent, ...prev];
      });
      triggerFlash();
    });

    const unsubSecretRef = subscribeEvent("secret_ref_event", (event) => {
      const data = event.data as Record<string, unknown> | undefined;
      if (!data) return;
      const wsEvent: WsSecurityEvent = {
        id: (data.id as string | undefined) ?? crypto.randomUUID(),
        type: "secret_ref_event",
        description: (data.description as string | undefined) ?? "",
        severity: (data.severity as string | undefined) ?? "medium",
        timestamp: typeof data.timestamp === "number" ? data.timestamp : Date.now() / 1000,
      };
      setWsEvents((prev) => {
        if (prev.some((e) => e.id === wsEvent.id)) return prev;
        return [wsEvent, ...prev];
      });
      triggerFlash();
    });

    return () => {
      unsubSecurity();
      unsubSecretRef();
    };
  }, [subscribeEvent, triggerFlash]);

  return (
    <div ref={flashRef} className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min">
      <div className="md:col-span-12">
        <PageHeader
          title="Security Dashboard"
          actions={<span className="text-sm text-muted-foreground">{mergedEvents.length} events</span>}
        />
      </div>

      <div className="md:col-span-12">
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="browser-guard">Browser Guard</TabsTrigger>
          <TabsTrigger value="network-policy">Network Policy</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab (existing content preserved) ── */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Severity Stats */}
          <SecurityStats />

          {/* Severity filter tabs */}
          <div className="flex gap-1 bg-card border border-border rounded-lg p-1 w-fit">
            {SEVERITY_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setSeverityFilter(tab)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                  severityFilter === tab
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Security Event Feed */}
          <SectionErrorBoundary name="Security Events">
            <SecurityEventFeed events={filteredEvents} />
            <LoadMoreButton status={securityStatus} loadMore={loadMoreSecurity} />
          </SectionErrorBoundary>

          {/* Audit & Compliance */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-base font-semibold text-muted-foreground mb-4">Audit & Compliance<InfoTooltip text="Security audit metrics: RLS isolation tests, audit chain integrity, human-in-the-loop status, webhook validation, and credential vault access" /></h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* RLS Isolation */}
              <div className="bg-background border border-border rounded-lg p-3">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  RLS Isolation
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last test</span>
                    <span className="text-muted-foreground">
                      {rlsStats === undefined ? <Skeleton className="h-4 w-16" /> : rlsStats ? formatRelativeTime(rlsStats.lastTest) : "--"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cross-profile blocked</span>
                    <span className={rlsStats ? statusColor(rlsStats.crossProfileBlocked, { warn: 1, danger: 5 }) : "text-muted-foreground"}>
                      {rlsStats === undefined ? <Skeleton className="h-4 w-8" /> : (rlsStats?.crossProfileBlocked ?? 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Audit Chain */}
              <div className="bg-background border border-border rounded-lg p-3">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Audit Chain
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Events</span>
                    <span className="text-muted-foreground">{mergedEvents.length} events loaded</span>
                  </div>
                </div>
              </div>

              {/* HITL Status */}
              <div className="bg-background border border-border rounded-lg p-3">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  HITL Status
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pending confirmations</span>
                    <span className={hitlStats ? statusColor(hitlStats.pending, { warn: 3, danger: 10 }) : "text-muted-foreground"}>
                      {hitlStats === undefined ? <Skeleton className="h-4 w-8" /> : (hitlStats?.pending ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resolved today</span>
                    <span className="text-muted-foreground">
                      {hitlStats === undefined ? <Skeleton className="h-4 w-8" /> : (hitlStats?.resolvedToday ?? 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Webhook Validation */}
              <div className="bg-background border border-border rounded-lg p-3">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Webhook Validation
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Received</span>
                    <span className="text-muted-foreground">
                      {webhookStats === undefined ? <Skeleton className="h-4 w-8" /> : (webhookStats?.totalReceived ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Forged / blocked</span>
                    <span className={webhookStats ? statusColor(webhookStats.forgedBlocked, { warn: 1, danger: 3 }) : "text-muted-foreground"}>
                      {webhookStats === undefined ? <Skeleton className="h-4 w-8" /> : (webhookStats?.forgedBlocked ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last received</span>
                    <span className="text-muted-foreground">
                      {webhookStats === undefined ? <Skeleton className="h-4 w-16" /> : webhookStats ? formatRelativeTime(webhookStats.lastReceived) : "--"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vault Status */}
              <div className="bg-background border border-border rounded-lg p-3">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Credential Vault
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total accesses</span>
                    <span className="text-muted-foreground">
                      {vaultStats === undefined ? <Skeleton className="h-4 w-8" /> : (vaultStats?.totalAccesses ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Denied</span>
                    <span className={vaultStats ? statusColor(vaultStats.denied, { warn: 1, danger: 3 }) : "text-muted-foreground"}>
                      {vaultStats === undefined ? <Skeleton className="h-4 w-8" /> : (vaultStats?.denied ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last access</span>
                    <span className="text-muted-foreground">
                      {vaultStats === undefined ? <Skeleton className="h-4 w-16" /> : vaultStats ? formatRelativeTime(vaultStats.lastAccess) : "--"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sandbox Enforcement */}
              <div className="bg-background border border-border rounded-lg p-3">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Sandbox Enforcement
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total violations</span>
                    <span className={sandboxOverview ? statusColor(sandboxOverview.totalViolations, { warn: 5, danger: 20 }) : "text-muted-foreground"}>
                      {sandboxOverview === undefined ? <Skeleton className="h-4 w-8" /> : (sandboxOverview?.totalViolations ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Strict blocked</span>
                    <span className={sandboxOverview ? statusColor(sandboxOverview.strictBlocked, { warn: 1, danger: 5 }) : "text-muted-foreground"}>
                      {sandboxOverview === undefined ? <Skeleton className="h-4 w-8" /> : (sandboxOverview?.strictBlocked ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last violation</span>
                    <span className="text-muted-foreground">
                      {sandboxOverview === undefined ? <Skeleton className="h-4 w-16" /> : sandboxOverview ? formatRelativeTime(sandboxOverview.lastViolation) : "--"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sandbox Violations Feed */}
          {(recentViolations ?? []).length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
                Sandbox Violations
                <InfoTooltip text="Tool capability manifest violations — tools accessing resources beyond their declared permissions" />
              </h2>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {(recentViolations ?? []).map((v: any, i: number) => (
                  <div key={v._id} className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${i % 2 === 0 ? "bg-card" : ""}`}>
                    <span className={`w-2 h-2 rounded-full ${v.strict ? "bg-red-400" : "bg-yellow-400"}`} />
                    <span className="text-muted-foreground font-mono w-16 shrink-0">{formatRelativeTime(v.timestamp)}</span>
                    <span className="text-foreground font-mono">{v.toolName}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${v.strict ? "bg-red-400/10 text-red-400" : "bg-yellow-400/10 text-yellow-400"}`}>
                      {v.permission}
                    </span>
                    {v.detail && <span className="text-muted-foreground truncate">{v.detail}</span>}
                    <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${v.strict ? "bg-red-400/10 text-red-400" : "bg-yellow-400/10 text-yellow-400"}`}>
                      {v.strict ? "BLOCKED" : "warned"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Browser Guard Tab ── */}
        <TabsContent value="browser-guard" className="space-y-6 mt-4">
          <SectionErrorBoundary name="Browser Guard">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-1">URLs Blocked</p>
                <p className="text-2xl font-semibold tabular-nums" style={{ color: bgBlocked > 0 ? "var(--status-error)" : undefined }}>
                  {bgBlocked}
                </p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-1">URLs Allowed</p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">{bgAllowed}</p>
              </div>
            </div>

            {/* Browser Guard event table */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">URL Evaluation Log</h2>
              {browserGuardEvents.length === 0 ? (
                <p className="text-base text-muted-foreground py-6 text-center">
                  No URL blocks recorded. Browser Guard is active and logging will appear here as URLs are evaluated.
                </p>
              ) : (
                <div className="max-h-[400px] overflow-y-auto">
                  {/* Header */}
                  <div className="grid grid-cols-[120px_1fr_80px_1fr] items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground uppercase tracking-wider border-b border-border bg-card sticky top-0">
                    <span>Timestamp</span>
                    <span>URL</span>
                    <span>Action</span>
                    <span>Reason</span>
                  </div>
                  {browserGuardEvents.map((e: any, i: number) => (
                    <div
                      key={e._id ?? i}
                      className={`grid grid-cols-[120px_1fr_80px_1fr] items-center gap-2 px-3 py-2 text-sm ${i % 2 === 0 ? "bg-card" : ""}`}
                    >
                      <span className="text-muted-foreground font-mono truncate">
                        {formatRelativeTime(e.timestamp)}
                      </span>
                      <span className="font-mono text-muted-foreground truncate" title={e.details?.url ?? e.description}>
                        {e.details?.url ?? e.description}
                      </span>
                      <span>
                        <StatusBadge
                          status={e.eventType === "browser_guard_block" ? "error" : "ok"}
                          label={e.eventType === "browser_guard_block" ? "BLOCKED" : "ALLOWED"}
                        />
                      </span>
                      <span className="text-muted-foreground truncate">{e.details?.reason ?? "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionErrorBoundary>
        </TabsContent>

        {/* ── Network Policy Tab ── */}
        <TabsContent value="network-policy" className="space-y-6 mt-4">
          <SectionErrorBoundary name="Network Policy">
            {/* Network access log */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">Network Access Log</h2>
              {networkPolicyEvents.length === 0 ? (
                <p className="text-base text-muted-foreground py-6 text-center">
                  No network policy events recorded. Access log will appear here as providers make outbound requests.
                </p>
              ) : (
                <div className="max-h-[300px] overflow-y-auto">
                  <div className="grid grid-cols-[120px_1fr_80px_1fr] items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground uppercase tracking-wider border-b border-border bg-card sticky top-0">
                    <span>Timestamp</span>
                    <span>Host</span>
                    <span>Action</span>
                    <span>Details</span>
                  </div>
                  {networkPolicyEvents.map((e: any, i: number) => (
                    <div
                      key={e._id ?? i}
                      className={`grid grid-cols-[120px_1fr_80px_1fr] items-center gap-2 px-3 py-2 text-sm ${i % 2 === 0 ? "bg-card" : ""}`}
                    >
                      <span className="text-muted-foreground font-mono truncate">{formatRelativeTime(e.timestamp)}</span>
                      <span className="font-mono text-muted-foreground truncate">{e.details?.host ?? e.description}</span>
                      <span>
                        <StatusBadge
                          status={e.eventType === "network_policy_block" ? "error" : "ok"}
                          label={e.eventType === "network_policy_block" ? "BLOCKED" : "ALLOWED"}
                        />
                      </span>
                      <span className="text-muted-foreground truncate">{e.details?.reason ?? "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionErrorBoundary>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
