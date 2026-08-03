/**
 * LlmStatusPanel — panel (d), Phase 188 Plan 11 (D-18).
 *
 * A pure promotion of telemetry that already exists elsewhere in the app — no new backend
 * query. Renders the currently-resolved brain (the SAME resolver `BrainControl`/`Chat.tsx`
 * read, `useResolvedBrain`, so this surface can never disagree with the header badge — see
 * `Chat.tsx`'s own `useResolvedBrain` docstring for the agreement requirement) plus a
 * per-provider health chip row sourced from `useProviderHealth()` — the exact circuit-breaker
 * data `ProviderHealthPanel.tsx`/`BrainPickerRow.tsx` already render, re-tokenized to
 * `--status-*` CSS vars instead of `ProviderHealthPanel.tsx`'s hardcoded Tailwind color-500
 * literals (CLAUDE.md § Styling).
 *
 * Chip state (`resolveChipState`, pure + exported for direct unit test) follows
 * `ReadinessPill`'s existing 4-colour mapping:
 *   - `--status-warn` — the provider's circuit is tripped (`state === "open"`, i.e. cooldown)
 *     or it is reachable but unauthenticated (degraded) — `authenticated === false` matches
 *     `ProviderHealthPanel.tsx`'s own degraded reading.
 *   - `--status-info` — the circuit is `half_open` (actively re-testing after a trip = routing
 *     in progress).
 *   - `--primary` — this provider handled the most recently completed LLM call (`useLlmMetrics`'
 *     newest row's own `provider` field, the same field `llm.ts`'s `providerBreakdown`/
 *     `costByProvider` group by) — the resolved winner.
 *   - `--muted-foreground` — no health data yet, or a healthy-but-not-currently-winning
 *     provider. Chips for EVERY configured provider always render (never disappear while
 *     loading), so the panel structurally cannot render empty.
 *
 * Read-only: dispatches nothing, offers no controls — brain swapping already lives in
 * `BrainControl`.
 *
 * @see 188-UI-SPEC.md "Control Center (D-18)" panel table row (d)
 */

import { Cpu } from "lucide-react";
import { useResolvedBrain } from "@/hooks/useResolvedBrain";
import { useProviderHealth } from "@/hooks/useProviderHealth";
import { useLlmMetrics } from "@/hooks/useLlmMetrics";
import { ALL_PROVIDERS, PROVIDER_COLORS, PROVIDER_DISPLAY_NAMES } from "@/lib/providers";

export type LlmChipState = "winner" | "routing" | "warn" | "idle";

const CHIP_STATE_CLASS: Record<LlmChipState, string> = {
  winner: "text-primary bg-primary/10 border-primary/30",
  routing: "text-(--status-info) bg-(--status-info)/10 border-(--status-info)/30",
  warn: "text-(--status-warn) bg-(--status-warn)/10 border-(--status-warn)/30",
  idle: "text-muted-foreground bg-muted/30 border-border/50",
};

export interface ProviderHealthEntry {
  state?: string;
  authenticated?: boolean;
}

/**
 * resolveChipState — PURE, no React/Convex dependency. Exported for direct unit test.
 *
 * Precedence: a tripped circuit or a failed auth check both read as `--status-warn`
 * (cooldown/degraded) regardless of whether this provider happens to also be the most
 * recent winner — an unhealthy provider must never paint primary. `half_open` (actively
 * re-testing) reads as routing-in-progress. Only once neither warning condition applies do
 * we check "is this the provider that answered the last completed call".
 */
export function resolveChipState(
  providerName: string,
  health: ProviderHealthEntry | undefined,
  winnerProvider: string | null
): LlmChipState {
  if (!health) return "idle";
  if (health.state === "open") return "warn";
  if (health.authenticated === false) return "warn";
  if (health.state === "half_open") return "routing";
  if (providerName === winnerProvider) return "winner";
  return "idle";
}

export function LlmStatusPanel() {
  const resolved = useResolvedBrain();
  // Same fallback BrainControl.tsx uses (`override ?? lastTurnModel ?? "Auto"`), expressed
  // through the shared resolver: `resolved.source === "none"` is exactly the case where
  // neither a global override nor any reported/last-turn engine exists.
  const brainLabel = resolved.source === "none" ? "Auto" : resolved.model ?? "Auto";

  const health = useProviderHealth() as Record<string, ProviderHealthEntry | undefined>;
  const { calls } = useLlmMetrics(1);
  const winnerProvider =
    (calls[0] as { provider?: string } | undefined)?.provider ?? null;

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-md p-5 flex flex-col gap-3 min-w-[240px]">
      <span className="font-mono text-sm tracking-[0.1em] text-muted-foreground flex items-center gap-2">
        <Cpu className="w-4 h-4" aria-hidden="true" />
        LLM STATUS
      </span>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
        <span className="font-mono text-sm text-muted-foreground">BRAIN</span>
        <span className="font-mono text-sm text-foreground/90">{brainLabel}</span>
      </div>

      <div className="flex flex-wrap gap-1.5" data-testid="llm-status-chip-row">
        {ALL_PROVIDERS.map((provider) => {
          const chipState = resolveChipState(provider, health[provider], winnerProvider);
          return (
            <span
              key={provider}
              data-testid="llm-status-chip"
              data-provider={provider}
              data-state={chipState}
              className={`flex items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-sm ${CHIP_STATE_CLASS[chipState]}`}
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: PROVIDER_COLORS[provider] ?? "var(--muted-foreground)" }}
              />
              {PROVIDER_DISPLAY_NAMES[provider] ?? provider}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default LlmStatusPanel;
