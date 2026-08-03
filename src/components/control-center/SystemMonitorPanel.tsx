/**
 * SystemMonitorPanel — panel (e), Phase 188 Plan 11 (D-18).
 *
 * A pure promotion of `VitalsRail.tsx`'s "System Vitals" + "Context &
 * Throughput" cards into the JARVIS-styled command-center panel set — same
 * hooks, same derivation, no new backend query. Uses the shared `RadialGauge`
 * (188-11 Task 2 extracted it out of `VitalsRail.tsx` so both consumers
 * render the exact same gauge, not a copy-pasted second implementation) and
 * the shared `contextWindow`/`fmtK` helpers from `vitalsHelpers.ts`.
 *
 * Honest-data constraints carried forward verbatim from `VitalsRail.tsx`'s
 * own docstring — a future reader must not "fix" any of these:
 *   - No GPU source anywhere in the schema → the third ring is DISK, never
 *     a GPU gauge.
 *   - No TTFT (first-token) timestamp anywhere in the schema → the latency
 *     meter is end-to-end `latencyMs`, labelled "Latency", never "TTFT".
 *   - No stored tokens/sec field → DERIVED from
 *     `completionTokens / (latencyMs / 1000)` of the most recent real
 *     completion, exactly as `VitalsRail.tsx` derives it.
 *   - No stored context-window max → derived from the same known per-model
 *     map `VitalsRail.tsx` uses; the fuel bar hides for an unrecognised
 *     model rather than inventing a denominator.
 *
 * Uses `ControlCenterPanel`'s `p-5` chrome for the container — NOT
 * `VitalsRail`'s own lighter `Card` chrome — per UI-SPEC's one-density rule
 * for every panel in this new layout.
 *
 * @see 188-UI-SPEC.md "Control Center (D-18)" panel table row (e)
 */

import { useMemo } from "react";
import { Activity } from "lucide-react";
import { useSystemResources } from "@/hooks/useSystemResources";
import { useLlmMetrics } from "@/hooks/useLlmMetrics";
import { useLastTurnModel } from "@/hooks/useResolvedBrain";
import { RadialGauge } from "@/components/chat/RadialGauge";
import { contextWindow, fmtK } from "@/components/chat/vitalsHelpers";

// VitalsRail never plotted a disk gauge, so there is no prior threshold to
// copy — 90% mirrors the CPU/RAM gauges' own "call it out before it's
// critical" posture (CPU warns at 85%, RAM at 80%).
const DISK_WARN_AT = 90;

export function SystemMonitorPanel() {
  const sys = useSystemResources();
  const { calls } = useLlmMetrics(25);
  const lastTurnModel = useLastTurnModel();

  const ramPct = sys?.ram ? (sys.ram.used / sys.ram.total) * 100 : undefined;
  const diskPct = sys?.disk ? (sys.disk.used / sys.disk.total) * 100 : undefined;

  // Same derivation VitalsRail.tsx's own `llm` useMemo performs — kept local
  // (not extracted) since it is plain arithmetic over the shared
  // `useLlmMetrics` hook's own return shape, not a rendering component.
  const llm = useMemo(() => {
    const recent = calls.slice(0, 25);
    const lastReal = recent.find(
      (c) => (c.completionTokens ?? 0) > 0 && (c.latencyMs ?? 0) > 0
    );
    const tokPerSec = lastReal ? lastReal.completionTokens / (lastReal.latencyMs / 1000) : null;
    const withLatency = recent.filter((c) => (c.latencyMs ?? 0) > 0);
    const avgLatency = withLatency.length
      ? withLatency.reduce((s, c) => s + c.latencyMs, 0) / withLatency.length
      : null;
    const cost = recent.reduce((s, c) => s + (c.cost ?? 0), 0);
    const lastCtx = recent[0]?.promptTokens ?? null;
    const model = lastTurnModel ?? recent[0]?.model ?? null;
    return { tokPerSec, avgLatency, cost, lastCtx, model };
  }, [calls, lastTurnModel]);

  const ctxMax = contextWindow(llm.model);
  const ctxPct =
    ctxMax && llm.lastCtx != null ? Math.min(100, (llm.lastCtx / ctxMax) * 100) : null;

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-md p-5 flex flex-col gap-3 min-w-[240px]">
      <span className="font-mono text-sm tracking-[0.1em] text-muted-foreground flex items-center gap-2">
        <Activity className="w-4 h-4" aria-hidden="true" />
        SYSTEM MONITOR
      </span>

      {/* Ring cluster — CPU / RAM / DISK (never GPU — the schema stores no
          GPU source at all). Rings always plot a value (RadialGauge renders
          "—" rather than disappearing), so this cluster structurally cannot
          render empty. */}
      <div className="grid grid-cols-3 gap-1">
        <RadialGauge value={sys?.cpu} label="CPU" warnAt={85} />
        <RadialGauge value={ramPct} label="RAM" warnAt={80} />
        <RadialGauge value={diskPct} label="DISK" warnAt={DISK_WARN_AT} />
      </div>

      {/* Throughput meters — Latency is end-to-end (never TTFT); Tok/s is
          DERIVED, not a stored field. */}
      <div className="grid grid-cols-3 divide-x divide-border/40 border-t border-border/40 pt-2">
        <div className="text-center px-1">
          <div className="font-mono font-bold text-sm tabular-nums">
            {llm.tokPerSec != null ? Math.round(llm.tokPerSec) : "—"}
            {llm.tokPerSec != null && (
              <span className="text-sm text-muted-foreground font-medium"> t/s</span>
            )}
          </div>
          <div className="font-mono text-sm tracking-[0.1em] uppercase text-muted-foreground mt-0.5">
            Tok/s
          </div>
        </div>
        <div className="text-center px-1">
          <div className="font-mono font-bold text-sm tabular-nums">
            {llm.avgLatency != null ? (llm.avgLatency / 1000).toFixed(2) : "—"}
            {llm.avgLatency != null && (
              <span className="text-sm text-muted-foreground font-medium">s</span>
            )}
          </div>
          <div className="font-mono text-sm tracking-[0.1em] uppercase text-muted-foreground mt-0.5">
            Latency
          </div>
        </div>
        <div className="text-center px-1">
          <div className="font-mono font-bold text-sm tabular-nums">${llm.cost.toFixed(2)}</div>
          <div className="font-mono text-sm tracking-[0.1em] uppercase text-muted-foreground mt-0.5">
            Session
          </div>
        </div>
      </div>

      {/* Context fuel bar — hides for an unrecognised model rather than
          inventing a denominator (VitalsRail's own honest-data rule). */}
      {ctxPct != null && (
        <div data-testid="context-fuel-bar">
          <div className="flex items-baseline justify-between mb-1">
            <span className="font-mono text-sm text-muted-foreground">
              {fmtK(llm.lastCtx as number)} / {fmtK(ctxMax as number)} ctx
            </span>
            <span className="font-mono text-sm text-primary tabular-nums">
              {Math.round(ctxPct)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${ctxPct}%`, transition: "width .5s ease" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default SystemMonitorPanel;
