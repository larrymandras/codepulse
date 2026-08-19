/**
 * metricState.ts — the shared six-state vocabulary for CodePulse's honesty
 * sweep (TOKEN-04/TOKEN-05, Phase 122 D-19/D-20).
 *
 * One module defines what a metric tile or an empty panel is allowed to say
 * about the data behind it: `MetricCard` renders this table at tile scale,
 * `EmptyState` renders it at panel/page scale, so the same backend condition
 * reads identically wherever it surfaces. Neither consumer defines its own
 * copy, icon or tone — see `loomStepState.ts`'s `STEP_STATE_COLOR` for the
 * precedent this follows (a single table, one comment per non-obvious
 * mapping, tokens only, never a hex or a palette class).
 */

import type { LucideIcon } from "lucide-react";
import { Loader2, CircleCheck, CircleSlash, Clock, Ban, AlertTriangle } from "lucide-react";

/**
 * The six states, no more, no fewer:
 * - loading: no value yet, Convex `useQuery` is returning `undefined`
 * - ready: a real value exists and is current
 * - empty: the query resolved with nothing to show (D-20: "no signal yet")
 * - stale: a real value exists but is older than the caller's staleness window
 * - unavailable: no emitter exists behind this metric at all (caller-declared,
 *   never inferred — see `useMetricState.ts`'s header comment for why)
 * - error: the query threw and was caught by `SectionErrorBoundary` one layer
 *   up; this state composes with that boundary rather than duplicating it
 */
export type MetricState = "loading" | "ready" | "empty" | "stale" | "unavailable" | "error";

export interface MetricStateEntry {
  /** Default copy for this state. Any call site may override where genuine
   *  context exists (D-20) — this is the fallback, not a mandate. */
  label: string;
  /** Lucide icon component. This repo is Lucide-only (CLAUDE.md); never an
   *  emoji, never a raw string. */
  icon: LucideIcon;
  /** Always a `var(--token)` reference. Never a hex, never a Tailwind
   *  palette class — the whole point of the token layer this state module
   *  sits on top of. */
  tone: string;
}

export const METRIC_STATE_COPY: Record<MetricState, MetricStateEntry> = {
  // Neutral tone: a metric that has not loaded yet has no health to report.
  // Rendering it in a status colour would assert something nobody knows.
  // Never rendered as visible text at either scale — MetricCard and
  // EmptyState both route `loading` to a content-shaped skeleton instead
  // (design law: skeletons are shaped like the content they replace, never
  // a generic bar and never the word "Loading"). The label exists so the
  // table has no undefined entries and so an aria-label / test id has
  // something honest to read.
  loading: {
    label: "Loading",
    icon: Loader2,
    tone: "var(--muted-foreground)",
  },

  // `ready` renders the actual value, not this copy — there is nothing to
  // say about a metric that is simply working. It still gets a real entry
  // (rather than being left undefined) so every consumer can index the
  // table uniformly instead of special-casing one member of the union.
  ready: {
    label: "Ready",
    icon: CircleCheck,
    tone: "var(--muted-foreground)",
  },

  // D-20: "no signal yet" is design law, exact string, lowercase as written.
  // Neutral tone for the same reason as `unavailable` below: an absence of
  // data is not evidence of failure, and colouring it as an error would be
  // the exact false claim TOKEN-04 exists to remove.
  empty: {
    label: "no signal yet",
    icon: CircleSlash,
    tone: "var(--muted-foreground)",
  },

  // States what is true (the figure is old) without claiming what is not
  // known (that it is wrong). Warn tone: an aging figure is worth a glance,
  // but it is still a real value — the caller renders it alongside this
  // copy rather than hiding it (see useMetricState.ts / MetricCard's own
  // stale behavior).
  stale: {
    label: "figure may be out of date",
    icon: Clock,
    tone: "var(--status-warn)",
  },

  // Neutral tone, deliberately: a metric with no emitter behind it is not
  // an error, it is an absence. `unavailable` is always caller-supplied
  // (see useMetricState.ts) precisely because Convex's `undefined` cannot
  // structurally distinguish "nothing will ever emit here" from "still
  // loading" — guessing either way would be the fabrication TOKEN-04
  // removes, so this state exists as an explicit, honest opt-in.
  unavailable: {
    label: "nothing is emitting this metric",
    icon: Ban,
    tone: "var(--muted-foreground)",
  },

  // States that the query failed without claiming the underlying system is
  // down — that would be a broader claim than a single failed query
  // supports. Error tone: this is the one state that genuinely is a
  // problem. Reached only from inside `SectionErrorBoundary`'s fallback,
  // never inferred by the hook (see useMetricState.ts).
  error: {
    label: "this query failed",
    icon: AlertTriangle,
    tone: "var(--status-error)",
  },
};

/**
 * Default staleness window: 5 minutes. Every table this dashboard reads is
 * a live Convex subscription, so under normal operation a tile updates
 * within seconds of the underlying data changing — a value that has sat
 * unchanged for 5 minutes on a subscription designed to be near-real-time
 * is worth flagging as possibly stale rather than presented as current.
 * D-14 makes `staleAfter` a per-tile prop that BEATS this default; this
 * constant exists so a tile with no stated opinion still has one.
 */
export const DEFAULT_STALE_AFTER_MS = 5 * 60 * 1000;
