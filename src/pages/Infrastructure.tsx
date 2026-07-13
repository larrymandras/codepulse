import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import OrbitalStatusRings from "../components/OrbitalStatusRings";
import DockerPanel from "../components/DockerPanel";
import SupabasePanel from "../components/SupabasePanel";
import SystemResources from "../components/SystemResources";
import IntegrationHealth from "../components/IntegrationHealth";
import GithubActionsPanel from "../components/GithubActionsPanel";
import CompactionTimeline from "../components/CompactionTimeline";
import ChannelHealthPanel from "../components/ChannelHealthPanel";
import ProviderHealthPanel from "../components/ProviderHealthPanel";
import CallGraphPanel from "../components/CallGraphPanel";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import { SectionHeader } from "../components/SectionHeader";
import { GlassPanel } from "../components/GlassPanel";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../components/ui/table";
import { Skeleton } from "../components/ui/skeleton";
import { useSystemResources } from "../hooks/useSystemResources";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { useLiveFlash } from "@/hooks/useLiveFlash";
import { PageHeader } from "@/components/PageHeader";

export default function Infrastructure() {
  const resourceData = useSystemResources();
  const { subscribeEvent } = useAstridrWS();
  const { flashRef, triggerFlash } = useLiveFlash();

  // Live Convex queries for v6.0 infrastructure sections (CPUX-12)
  const startupEvents = useQuery(api.startupEvents.recent, {});
  const authAliases = useQuery(api.authAliases.list);
  const providerMetrics = useQuery(api.advisorEvents.providerMetrics);

  useEffect(() => {
    // Docker/MCP WS events currently only drive the live-flash indicator —
    // no per-event payload is rendered anywhere on this page.
    const unsubDocker = subscribeEvent("docker_status", () => {
      triggerFlash();
    });

    const unsubMcp = subscribeEvent("mcp_connection", () => {
      triggerFlash();
    });

    return () => {
      unsubDocker();
      unsubMcp();
    };
  }, [subscribeEvent, triggerFlash]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min">
      <div className="md:col-span-12">
        <PageHeader title="Infrastructure" />
      </div>
      <div className="md:col-span-12">
        <OrbitalStatusRings />
      </div>
      <div className="md:col-span-12">
      <SectionErrorBoundary name="Infrastructure Health">
        <div ref={flashRef} className="space-y-6">
          <SectionErrorBoundary name="Channel Health">
            <ChannelHealthPanel />
          </SectionErrorBoundary>
          <SectionErrorBoundary name="Provider Health">
            <ProviderHealthPanel />
          </SectionErrorBoundary>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DockerPanel />
            <SupabasePanel />
          </div>
        </div>
      </SectionErrorBoundary>
      </div>
      <div className="md:col-span-12">
      <SystemResources data={resourceData} />
      </div>
      <div className="md:col-span-12">
      <IntegrationHealth />
      </div>
      <div className="md:col-span-12">
      <SectionErrorBoundary name="GitHub Actions">
        <GithubActionsPanel />
      </SectionErrorBoundary>
      </div>
      <div className="md:col-span-12">
      <SectionErrorBoundary name="Agent Call Graph">
        <CallGraphPanel />
      </SectionErrorBoundary>
      </div>
      <div className="md:col-span-12">
      <SectionErrorBoundary name="Compaction Timeline">
        <CompactionTimeline />
      </SectionErrorBoundary>
      </div>

      {/* Startup Waterfall (CPUX-12) — wired to startupEvents Convex query */}
      <div className="md:col-span-12">
      <SectionErrorBoundary name="Startup Waterfall">
        <SectionHeader title="Startup Waterfall" />
        <GlassPanel className="p-4 hover:scale-[1.01] transition-transform duration-300">
          {startupEvents && startupEvents.length > 0 ? (
            <div className="space-y-2">
              {startupEvents
                .slice()
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((evt, i) => {
                  const maxDuration = Math.max(...startupEvents.map(e => e.duration));
                  const widthPct = maxDuration > 0 ? (evt.duration / maxDuration) * 100 : 0;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-sm font-mono text-muted-foreground w-28 shrink-0 truncate">
                        {evt.subsystem ?? evt.phase}
                      </span>
                      <div className="flex-1 h-5 bg-muted/30 rounded-none overflow-hidden">
                        <div
                          className="h-full rounded-none"
                          style={{
                            width: `${widthPct}%`,
                            backgroundColor: "var(--primary)",
                            opacity: 0.8,
                          }}
                        />
                      </div>
                      <span className="text-sm tabular-nums text-muted-foreground w-16 text-right shrink-0">
                        {evt.duration.toFixed(0)}ms
                      </span>
                    </div>
                  );
                })}
              <div className="flex items-center justify-end pt-2 border-t border-border">
                <span className="text-sm text-muted-foreground mr-2">Total:</span>
                <span className="text-base font-semibold tabular-nums">
                  {startupEvents[0]?.totalMs?.toFixed(0) ?? "—"}ms
                </span>
              </div>
            </div>
          ) : startupEvents === undefined ? (
            <div className="space-y-4">
              <Skeleton className="h-5 w-full bg-primary/10" />
              <Skeleton className="h-5 w-full bg-primary/10" />
              <Skeleton className="h-5 w-full bg-primary/10" />
            </div>
          ) : (
            <p className="text-base text-muted-foreground">
              No startup events recorded yet. Events appear after the runtime emits startup telemetry via /startup-ingest.
            </p>
          )}
        </GlassPanel>
      </SectionErrorBoundary>
      </div>

      {/* Auth Aliases (CPUX-12) — wired to authAliases Convex query */}
      <div className="md:col-span-12">
      <SectionErrorBoundary name="Auth Aliases">
        <SectionHeader title="Auth Aliases" />
        <GlassPanel className="p-4 hover:scale-[1.01] transition-transform duration-300">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alias</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {authAliases && authAliases.length > 0 ? (
                authAliases.map((alias, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">{alias.alias}</TableCell>
                    <TableCell>{alias.provider}</TableCell>
                    <TableCell className="font-mono text-sm truncate max-w-[200px]">{alias.userId}</TableCell>
                    <TableCell className="tabular-nums text-sm text-muted-foreground">
                      {new Date(alias.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              ) : authAliases === undefined ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    <TableCell><Skeleton className="h-4 w-24 bg-primary/10" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32 bg-primary/10" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40 bg-primary/10" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 bg-primary/10" /></TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-base text-muted-foreground text-center py-8">
                    No auth aliases configured. Aliases are ingested via /auth-alias-ingest.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </GlassPanel>
      </SectionErrorBoundary>
      </div>

      {/* Advisor Provider Metrics (CPUX-12) */}
      <div className="md:col-span-12">
      <SectionErrorBoundary name="Advisor Providers">
        <SectionHeader title="Advisor Providers" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {providerMetrics === undefined ? (
            Array.from({ length: 4 }).map((_, i) => (
              <GlassPanel key={`skeleton-${i}`} className="p-4 flex flex-col gap-2">
                <Skeleton className="h-4 w-24 bg-primary/10" />
                <Skeleton className="h-8 w-20 bg-primary/10" />
                <Skeleton className="h-4 w-32 bg-primary/10" />
              </GlassPanel>
            ))
          ) : (providerMetrics ?? []).map(pm => (
            <GlassPanel key={pm.provider} className="p-4 hover:scale-[1.01] transition-transform duration-300">
              <p className="text-sm text-muted-foreground uppercase tracking-wide">{pm.provider}</p>
              <p className="text-2xl font-semibold tabular-nums mt-1">{pm.count} calls</p>
              <p className="text-sm text-muted-foreground mt-1">
                Avg: <span className="tabular-nums">${pm.avgCostUsd.toFixed(4)}</span>/call
                {pm.avgLatencyMs != null && <> · <span className="tabular-nums">{Math.round(pm.avgLatencyMs)}ms</span></>}
              </p>
            </GlassPanel>
          ))}
          {providerMetrics !== undefined && (!providerMetrics || providerMetrics.length === 0) && (
            <p className="text-base text-muted-foreground col-span-full">No advisor events recorded yet.</p>
          )}
        </div>
      </SectionErrorBoundary>
      </div>
    </div>
  );
}
