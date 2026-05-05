import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import OrbitalStatusRings from "../components/OrbitalStatusRings";
import ContextGauge from "../components/ContextGauge";
import DockerPanel from "../components/DockerPanel";
import SupabasePanel from "../components/SupabasePanel";
import SystemResources from "../components/SystemResources";
import IntegrationHealth from "../components/IntegrationHealth";
import GithubActionsPanel from "../components/GithubActionsPanel";
import ChannelHealthPanel from "../components/ChannelHealthPanel";
import ProviderHealthPanel from "../components/ProviderHealthPanel";
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
import { useSystemResources } from "../hooks/useSystemResources";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { useLiveFlash } from "@/hooks/useLiveFlash";

type DockerStatusPayload = {
  container?: string;
  status?: string;
  [key: string]: unknown;
};

type McpConnectionPayload = {
  server?: string;
  connected?: boolean;
  [key: string]: unknown;
};

export default function Infrastructure() {
  const resourceData = useSystemResources();
  const { subscribeEvent } = useAstridrWS();
  const { flashRef, triggerFlash } = useLiveFlash();

  // Live Convex queries for v6.0 infrastructure sections (CPUX-12)
  const startupEvents = useQuery(api.startupEvents.recent, {});
  const authAliases = useQuery(api.authAliases.list);
  const providerMetrics = useQuery(api.advisorEvents.providerMetrics);

  // Track latest WS-driven health status (transient overlay)
  const [_lastDockerStatus, setLastDockerStatus] = useState<DockerStatusPayload | null>(null);
  const [_lastMcpStatus, setLastMcpStatus] = useState<McpConnectionPayload | null>(null);

  useEffect(() => {
    const unsubDocker = subscribeEvent("docker_status", (event) => {
      const data = event.data as DockerStatusPayload | undefined;
      if (data) setLastDockerStatus(data);
      triggerFlash();
    });

    const unsubMcp = subscribeEvent("mcp_connection", (event) => {
      const data = event.data as McpConnectionPayload | undefined;
      if (data) setLastMcpStatus(data);
      triggerFlash();
    });

    return () => {
      unsubDocker();
      unsubMcp();
    };
  }, [subscribeEvent, triggerFlash]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Infrastructure</h1>
      <OrbitalStatusRings />
      {/* Phase 094: Context Gauge */}
      <SectionErrorBoundary name="Context Gauge">
        <ContextGauge />
      </SectionErrorBoundary>
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
      <SystemResources data={resourceData} />
      <IntegrationHealth />
      <SectionErrorBoundary name="GitHub Actions">
        <GithubActionsPanel />
      </SectionErrorBoundary>

      {/* Startup Waterfall (CPUX-12) — wired to startupEvents Convex query */}
      <SectionErrorBoundary name="Startup Waterfall">
        <SectionHeader title="Startup Waterfall" />
        <GlassPanel className="p-4">
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
                      <span className="text-xs font-mono text-muted-foreground w-28 shrink-0 truncate">
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
                      <span className="text-xs tabular-nums text-muted-foreground w-16 text-right shrink-0">
                        {evt.duration.toFixed(0)}ms
                      </span>
                    </div>
                  );
                })}
              <div className="flex items-center justify-end pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground mr-2">Total:</span>
                <span className="text-sm font-semibold tabular-nums">
                  {startupEvents[0]?.totalMs?.toFixed(0) ?? "—"}ms
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No startup events recorded yet. Events appear after the runtime emits startup telemetry via /startup-ingest.
            </p>
          )}
        </GlassPanel>
      </SectionErrorBoundary>

      {/* Auth Aliases (CPUX-12) — wired to authAliases Convex query */}
      <SectionErrorBoundary name="Auth Aliases">
        <SectionHeader title="Auth Aliases" />
        <GlassPanel className="p-4">
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
                    <TableCell className="font-mono text-xs">{alias.alias}</TableCell>
                    <TableCell>{alias.provider}</TableCell>
                    <TableCell className="font-mono text-xs truncate max-w-[200px]">{alias.userId}</TableCell>
                    <TableCell className="tabular-nums text-xs text-muted-foreground">
                      {new Date(alias.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground text-center py-8">
                    No auth aliases configured. Aliases are ingested via /auth-alias-ingest.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </GlassPanel>
      </SectionErrorBoundary>

      {/* Advisor Provider Metrics (CPUX-12) */}
      <SectionErrorBoundary name="Advisor Providers">
        <SectionHeader title="Advisor Providers" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(providerMetrics ?? []).map(pm => (
            <GlassPanel key={pm.provider} className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{pm.provider}</p>
              <p className="text-2xl font-semibold tabular-nums mt-1">{pm.count} calls</p>
              <p className="text-xs text-muted-foreground mt-1">
                Avg: <span className="tabular-nums">${pm.avgCostUsd.toFixed(4)}</span>/call
                {pm.avgLatencyMs != null && <> · <span className="tabular-nums">{Math.round(pm.avgLatencyMs)}ms</span></>}
              </p>
            </GlassPanel>
          ))}
          {(!providerMetrics || providerMetrics.length === 0) && (
            <p className="text-sm text-muted-foreground col-span-full">No advisor events recorded yet.</p>
          )}
        </div>
      </SectionErrorBoundary>

      {/* Network Policy per Provider (CPUX-12) */}
      <SectionErrorBoundary name="Network Policy">
        <SectionHeader title="Network Policy" />
        <GlassPanel className="p-4">
          <p className="text-sm text-muted-foreground">
            Per-provider network policy rules will appear here once policy configuration is ingested.
          </p>
        </GlassPanel>
      </SectionErrorBoundary>
    </div>
  );
}
