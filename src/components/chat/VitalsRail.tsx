/**
 * VitalsRail — column ③ of the Chat command center (Phase ~101, "Chat Command
 * Center" redesign). A live telemetry rail beside Ástríðr's presence, built
 * ENTIRELY from existing Convex tables — no new backend.
 *
 * Honest-data notes (the schema simply does not store these):
 *   - No GPU source anywhere → the third vitals gauge is DISK, not GPU.
 *   - No TTFT (first-token) timestamp → the latency meter is end-to-end
 *     `latencyMs`, labelled "Latency", not "TTFT".
 *   - No stored tokens/sec → derived from `completionTokens / (latencyMs/1000)`
 *     of the most recent real completion.
 *   - No context-window max → derived from a known per-model map; the fuel bar
 *     hides when the model is unrecognised rather than inventing a denominator.
 *
 * Wrapped by the caller in <SectionErrorBoundary> so a telemetry hiccup can
 * never blank the chat (a throwing useQuery unmounts the whole tree).
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, AlertTriangle } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useSystemResources } from "@/hooks/useSystemResources";
import { useLlmMetrics } from "@/hooks/useLlmMetrics";
import { useDockerHealth } from "@/hooks/useDockerHealth";
import { useMcpHealthSources } from "@/hooks/useMcpHealth";
import { useActiveAlerts } from "@/hooks/useAlerts";
import { useActiveSessions } from "@/hooks/useActiveSessions";
import { useRecentEvents } from "@/hooks/useRecentEvents";

// ── small presentational helpers ────────────────────────────────────────────

function Card({
  title,
  source,
  children,
}: {
  title: string;
  source: string;
  children: React.ReactNode;
}) {
  return (
    <div className="shrink-0 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-border/40 bg-muted/20">
        <h3 className="text-xs font-semibold tracking-wide flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_var(--primary)]" />
          {title}
        </h3>
        <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-muted-foreground border border-border/60 rounded px-1.5 py-0.5">
          {source}
        </span>
      </div>
      {children}
    </div>
  );
}

function RadialGauge({
  value,
  label,
  warnAt = 85,
}: {
  value: number | undefined | null;
  label: string;
  warnAt?: number;
}) {
  const has = value != null && Number.isFinite(value);
  const pct = has ? Math.max(0, Math.min(100, value as number)) : 0;
  const r = 29;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - pct / 100);
  const warn = has && pct >= warnAt;
  const stroke = warn ? "var(--status-warn)" : "var(--primary)";
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[64px] h-[64px]">
        <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" className="stroke-border/50" />
          <circle
            cx="36"
            cy="36"
            r={r}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            stroke={stroke}
            strokeDasharray={circ}
            strokeDashoffset={has ? off : circ}
            style={{ transition: "stroke-dashoffset .5s ease" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center font-mono font-bold text-sm tabular-nums">
          {has ? Math.round(pct) : "—"}
          {has && <span className="text-[9px] text-muted-foreground ml-0.5">%</span>}
        </div>
      </div>
      <div className="mt-1 font-mono text-[9px] tracking-[0.14em] uppercase text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function Meter({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div className="text-center px-1 py-2.5">
      <div className="font-mono font-bold text-sm tabular-nums">
        {value}
        {unit && <span className="text-[10px] text-muted-foreground font-medium">{unit}</span>}
      </div>
      <div className="font-mono text-[9px] tracking-[0.1em] uppercase text-muted-foreground mt-0.5">
        {label}
      </div>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 18 - ((p - min) / span) * 16;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="w-full h-5">
      <path d={d} fill="none" stroke="var(--primary)" strokeWidth="1.4" className="opacity-80" />
    </svg>
  );
}

// ── model context windows (public facts, not stored in-schema) ───────────────

function contextWindow(model: string | null | undefined): number | null {
  if (!model) return null;
  const m = model.toLowerCase();
  if (m.includes("1m")) return 1_000_000;
  if (m.includes("opus") || m.includes("sonnet") || m.includes("haiku")) return 200_000;
  if (m.includes("gpt-5") || m.includes("gpt5")) return 400_000;
  return null;
}

const fmtInt = (n: number) => Math.round(n).toLocaleString();
const fmtK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`);

// timestamps arrive as seconds in some tables, ms in others — normalise.
function relTime(t: number | undefined): string {
  if (!t) return "";
  const ms = t < 1e12 ? t * 1000 : t;
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function humanize(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // camelCase → spaced
    .replace(/[_-]+/g, " ") // snake/kebab → spaced
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function eventLabel(e: { eventType?: string; toolName?: string; hookType?: string }): string {
  if (e.toolName) return e.toolName; // tool names read fine as-is (Bash, Edit…)
  return humanize(e.eventType ?? e.hookType ?? "event");
}

// ── main ─────────────────────────────────────────────────────────────────────

export default function VitalsRail({
  lastTurnModel,
  disconnected,
}: {
  lastTurnModel: string | null;
  disconnected: boolean;
}) {
  const sys = useSystemResources();
  const { calls } = useLlmMetrics(25);
  const containers = useDockerHealth();
  const { mcpServers } = useMcpHealthSources();
  const alerts = useActiveAlerts();
  const sessions = useActiveSessions();
  const { events } = useRecentEvents(8);
  const recentSkills = useQuery(api.skillCategories.getRecentlyUsedSkills, { limit: 6 }) ?? [];

  const ramPct = sys?.ram ? (sys.ram.used / sys.ram.total) * 100 : undefined;

  const llm = useMemo(() => {
    const recent = calls.slice(0, 25);
    const lastReal = recent.find(
      (c) => (c.completionTokens ?? 0) > 0 && (c.latencyMs ?? 0) > 0
    );
    const tokPerSec = lastReal
      ? lastReal.completionTokens / (lastReal.latencyMs / 1000)
      : null;
    const withLatency = recent.filter((c) => (c.latencyMs ?? 0) > 0);
    const avgLatency = withLatency.length
      ? withLatency.reduce((s, c) => s + c.latencyMs, 0) / withLatency.length
      : null;
    const cost = recent.reduce((s, c) => s + (c.cost ?? 0), 0);
    const sessionTokens = recent.reduce((s, c) => s + (c.totalTokens ?? 0), 0);
    const lastCtx = recent[0]?.promptTokens ?? null;
    const model = lastTurnModel ?? recent[0]?.model ?? null;
    // recent tok/s series for the sparkline (oldest → newest)
    const series = recent
      .filter((c) => (c.completionTokens ?? 0) > 0 && (c.latencyMs ?? 0) > 0)
      .map((c) => c.completionTokens / (c.latencyMs / 1000))
      .reverse();
    return { tokPerSec, avgLatency, cost, sessionTokens, lastCtx, model, series };
  }, [calls, lastTurnModel]);

  const ctxMax = contextWindow(llm.model);
  const ctxPct =
    ctxMax && llm.lastCtx != null ? Math.min(100, (llm.lastCtx / ctxMax) * 100) : null;

  const connectedServers = mcpServers.filter((s) => s.status === "connected").length;
  // discoveredTools carries no source:"mcp" rows — the real MCP tool count lives
  // on the servers themselves (toolCount per connected server).
  const mcpToolCount = mcpServers.reduce((n, s) => n + (s.toolCount ?? 0), 0);

  const statusDot = (status: string) => {
    if (status === "running") return "bg-green-500";
    if (status === "paused" || status === "restarting" || status === "unknown")
      return "bg-yellow-500";
    if (status === "exited") return "bg-gray-500";
    return "bg-red-500";
  };

  return (
    <div className="flex flex-col gap-3 overflow-y-auto pr-0.5">
      {/* Active alerts — only rendered when there ARE any (silent at zero) */}
      {alerts.length > 0 && (
        <Link
          to="/alerts"
          className="group shrink-0 flex items-center justify-between rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 hover:bg-red-500/15 transition-colors"
          title="Open Alerts"
        >
          <span className="flex items-center gap-2 text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="text-[13px] font-semibold">
              {alerts.length} active {alerts.length === 1 ? "alert" : "alerts"}
            </span>
          </span>
          <ChevronRight className="w-4 h-4 text-red-300/60 group-hover:text-red-300 group-hover:translate-x-0.5 transition-all shrink-0" />
        </Link>
      )}

      {/* Now Serving — clickable jump-offs to where each thing is managed */}
      <Card title="Now Serving" source="live">
        <div className="divide-y divide-border/40">
          <Link
            to="/mcp-inventory"
            className="group flex items-center justify-between px-3.5 py-2.5 hover:bg-primary/5 transition-colors"
            title="Open MCP Inventory"
          >
            <span className="min-w-0">
              <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-muted-foreground block">
                MCP
              </span>
              <span className="text-[13px] font-semibold tabular-nums block">
                {connectedServers}
                <span className="text-muted-foreground font-normal">/{mcpServers.length}</span>{" "}
                servers
                <span className="text-muted-foreground font-normal"> · </span>
                {mcpToolCount} tools
              </span>
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>

          <Link
            to="/"
            className="group flex items-center justify-between px-3.5 py-2.5 hover:bg-primary/5 transition-colors"
            title="Active sessions on the Dashboard"
          >
            <span className="min-w-0">
              <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-muted-foreground block">
                Sessions
              </span>
              <span className="text-[13px] font-semibold tabular-nums block">
                {sessions.length}
                <span className="text-muted-foreground font-normal"> active</span>
              </span>
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>

          <Link
            to="/infrastructure"
            className="group flex items-center justify-between px-3.5 py-2.5 hover:bg-primary/5 transition-colors"
            title="Open Infrastructure"
          >
            <span className="flex items-center gap-3.5">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                <span
                  className={`w-2 h-2 rounded-full ${disconnected ? "bg-red-500" : "bg-green-500"}`}
                />
                Ástríðr
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Convex
              </span>
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>
        </div>
      </Card>

      {/* System Vitals */}
      <Card title="System Vitals" source="systemResources">
        <div className="grid grid-cols-2 gap-1 px-3 py-3.5">
          <RadialGauge value={sys?.cpu} label="CPU" warnAt={85} />
          <RadialGauge value={ramPct} label="RAM" warnAt={80} />
        </div>
        <div className="grid grid-cols-3 divide-x divide-border/40 border-t border-border/40">
          <Meter
            value={llm.tokPerSec != null ? Math.round(llm.tokPerSec).toString() : "—"}
            unit={llm.tokPerSec != null ? " t/s" : undefined}
            label="Tok/s"
          />
          <Meter
            value={llm.avgLatency != null ? (llm.avgLatency / 1000).toFixed(2) : "—"}
            unit={llm.avgLatency != null ? "s" : undefined}
            label="Latency"
          />
          <Meter value={`$${llm.cost.toFixed(2)}`} label="Session" />
        </div>
      </Card>

      {/* Context / Throughput */}
      <Card title="Context & Throughput" source="llmMetrics">
        <div className="px-3.5 py-3 space-y-3">
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="font-mono text-[13px] font-bold tabular-nums">
                {llm.lastCtx != null ? fmtK(llm.lastCtx) : "—"}
                {ctxMax && (
                  <span className="text-muted-foreground font-medium text-[11px]">
                    {" "}
                    / {fmtK(ctxMax)} ctx
                  </span>
                )}
              </span>
              {ctxPct != null && (
                <span className="font-mono text-[12px] text-primary tabular-nums">
                  {Math.round(ctxPct)}%
                </span>
              )}
            </div>
            {ctxPct != null ? (
              <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary shadow-[0_0_8px_var(--primary)]"
                  style={{ width: `${ctxPct}%`, transition: "width .5s ease" }}
                />
              </div>
            ) : (
              <div className="font-mono text-[10px] text-muted-foreground">
                last-turn context tokens
              </div>
            )}
          </div>
          {llm.series.length >= 2 && (
            <div>
              <Sparkline points={llm.series} />
              <div className="flex justify-between font-mono text-[9px] text-muted-foreground mt-0.5">
                <span>tok/s · last {llm.series.length}</span>
                <span>session {fmtInt(llm.sessionTokens)} tok</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Live Activity — recent tool calls / hook events (what she's doing now) */}
      <Card title="Live Activity" source="events">
        {events.length === 0 ? (
          <p className="text-[11px] font-mono text-muted-foreground text-center py-4 px-3">
            no recent activity…
          </p>
        ) : (
          <div className="divide-y divide-border/40">
            {events.slice(0, 6).map((e: { _id: string; eventType?: string; toolName?: string; hookType?: string; timestamp?: number }) => (
              <div key={e._id} className="flex items-center justify-between px-3.5 py-1.5 gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                  <span className="font-mono text-[11px] text-foreground/90 truncate">
                    {eventLabel(e)}
                  </span>
                </span>
                <span className="font-mono text-[9px] text-muted-foreground tabular-nums shrink-0">
                  {relTime(e.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent Launches — skills most recently run, by lastUsedAt */}
      <Card title="Recent Launches" source="skills">
        {recentSkills.length === 0 ? (
          <p className="text-[11px] font-mono text-muted-foreground text-center py-4 px-3">
            no skills launched yet…
          </p>
        ) : (
          <div className="divide-y divide-border/40">
            {recentSkills.map((s) => (
              <Link
                key={s.name}
                to="/skills"
                className="group flex items-center justify-between px-3.5 py-1.5 gap-2 hover:bg-primary/5 transition-colors"
                title="Open Skills"
              >
                <span className="font-mono text-[11px] text-foreground/90 truncate">
                  {s.displayName}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[9px] text-muted-foreground tabular-nums">
                    ×{s.useCount}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Agent & Container Health — compact, mirrors DockerPanel's statusColor */}
      <Card title="Container Health" source="dockerContainers">
        {containers.length === 0 ? (
          <p className="text-[11px] font-mono text-muted-foreground text-center py-4 px-3">
            waiting for container data…
          </p>
        ) : (
          <div className="max-h-[224px] overflow-y-auto grid grid-cols-2 gap-px bg-border/40">
            {containers.map((c: { _id: string; name: string; status?: string; health?: string }) => (
              <div
                key={c._id}
                className="bg-card/60 px-2.5 py-2 flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 shadow-[0_0_5px_currentColor] ${statusDot(
                      c.status ?? ""
                    )}`}
                  />
                  <span className="font-mono text-[11px] text-foreground/90 truncate">{c.name}</span>
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground shrink-0">
                  {c.health ?? c.status ?? ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
