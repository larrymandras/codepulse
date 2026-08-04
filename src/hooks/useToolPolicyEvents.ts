/**
 * useToolPolicyEvents — Convex live-query hooks + the pure kind-presentation
 * map for convex/toolPolicyEvents.ts (Phase 105 Plan 07, OBS-02).
 *
 * Mirrors useCostDerived.ts's useQuery-with-a-fallback-default wrapper
 * convention for `useToolPolicyEvents`/`useToolPolicyCounts` — loading and
 * "no data"
 * both collapse to the same honest-empty default shape so `ToolPolicyFeed`
 * can render unconditionally.
 *
 * `useToolPolicyLastReceived` is the deliberate exception, matching
 * useCostBudgets.ts's `useCostBudget` precedent: it returns the raw query
 * result, INCLUDING `undefined` while loading, rather than collapsing to a
 * default. D-07 needs "still loading" (undefined) to stay distinguishable
 * from "CodePulse has never received one" (a genuine `{ timestamp: null }`
 * once the query resolves) — folding both to the same value would make a
 * dead ingest pipe indistinguishable from a page that just hasn't finished
 * its first render, which is exactly the distinction D-07 exists to
 * preserve.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ALERTING_POLICY_KINDS } from "../../convex/toolPolicyAlertEval";

export type ToolPolicyEventRow = {
  _id: string;
  event: string;
  tool?: string;
  sessionId?: string;
  agentId?: string;
  taskCategory?: string;
  toolWasOffered?: boolean;
  toolsOfferedCount?: number;
  round?: number;
  field?: string;
  error?: string;
  timestamp: number;
};

export type ToolPolicyFeedResult = {
  rows: ToolPolicyEventRow[];
  truncated: boolean;
  cap: number;
};

export type ToolPolicyCountsResult = {
  counts: Record<string, number>;
  truncated: boolean;
  windowSeconds: number;
};

export type ToolPolicyLastReceivedResult = { timestamp: number | null };

/**
 * Finding F1 / UI-SPEC § Color — the locked kind ordering (worst fail-open
 * first, then the two view-only kinds). Not alphabetical, not insertion
 * order from the schema — a deliberate presentation order.
 */
export const POLICY_KIND_ORDER: readonly string[] = [
  "malformed_policy_boot",
  "malformed_policy_reload_rejected",
  "tool_call_leaked_as_text",
  "execution_denied",
] as const;

const DEFAULT_FEED: ToolPolicyFeedResult = { rows: [], truncated: false, cap: 0 };

const DEFAULT_COUNTS: ToolPolicyCountsResult = {
  counts: Object.fromEntries(POLICY_KIND_ORDER.map((kind) => [kind, 0])),
  truncated: false,
  windowSeconds: 0,
};

export { DEFAULT_FEED, DEFAULT_COUNTS };

export type PolicyKindPresentation = {
  label: string;
  token: string;
  alerts: boolean;
};

/** UI-SPEC § Color's locked kind -> (label, token) mapping. The `alerts` flag
 * is deliberately NOT stored here — see `policyKindPresentation` below,
 * which derives it from `ALERTING_POLICY_KINDS` so the badge and the
 * evaluator can never disagree about which kinds alert. */
const KIND_LABEL_AND_TOKEN: Record<string, { label: string; token: string }> = {
  malformed_policy_boot: {
    label: "Boot degraded to permissive",
    token: "var(--status-error)",
  },
  malformed_policy_reload_rejected: {
    label: "Reload rejected — prior policy kept",
    token: "var(--status-warn)",
  },
  tool_call_leaked_as_text: {
    label: "Leaked as text",
    token: "var(--status-warn)",
  },
  execution_denied: {
    label: "Blocked by policy",
    token: "var(--status-info)",
  },
};

const ALERTING_KIND_SET = new Set<string>(ALERTING_POLICY_KINDS);

/**
 * The four-kind badge/label/alert mapping. An unrecognised kind is shown
 * VERBATIM — the raw string as its own label, a neutral token, no alert —
 * never hidden, never guessed into one of the four known kinds.
 */
export function policyKindPresentation(kind: string): PolicyKindPresentation {
  const known = KIND_LABEL_AND_TOKEN[kind];
  if (known) {
    return { ...known, alerts: ALERTING_KIND_SET.has(kind) };
  }
  return { label: kind, token: "var(--muted-foreground)", alerts: false };
}

/** Most recent policy events, optionally filtered to one kind. */
export function useToolPolicyEvents(kind?: string, limit?: number): ToolPolicyFeedResult {
  return (
    (useQuery(api.toolPolicyEvents.recent, {
      event: kind,
      limit,
    }) as ToolPolicyFeedResult | undefined) ?? DEFAULT_FEED
  );
}

/** Per-kind counts over a trailing window, every one of the 4 kinds zero-filled. */
export function useToolPolicyCounts(sinceSeconds?: number): ToolPolicyCountsResult {
  return (
    (useQuery(api.toolPolicyEvents.countsByKind, {
      sinceSeconds,
    }) as ToolPolicyCountsResult | undefined) ?? DEFAULT_COUNTS
  );
}

/**
 * D-07 — the raw `lastReceivedAt` query result, deliberately NOT defaulted.
 * See this file's header comment: collapsing `undefined` into `null` would
 * make "still loading" indistinguishable from "CodePulse has never received
 * one", which is the exact distinction D-07 exists to preserve.
 */
export function useToolPolicyLastReceived(): ToolPolicyLastReceivedResult | undefined {
  return useQuery(api.toolPolicyEvents.lastReceivedAt, {}) as
    | ToolPolicyLastReceivedResult
    | undefined;
}
