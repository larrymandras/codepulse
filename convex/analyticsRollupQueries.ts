// Phase 88 Plan 04 — Pure read-path derivations for the analytics queries.
//
// These functions take the SLIM `aggregates` bucket rows (already collected via
// the by_type_period_bucket index in convex/analytics.ts) and fold them into the
// exact return shapes the Analytics UI consumes. They contain ZERO Convex/db
// access so they are unit-testable in plain Vitest (convex/analytics.test.ts) and
// so the read-time derivation stays in one auditable place.
//
// The query handlers in convex/analytics.ts do the index-bounded `.collect()`
// (no .take cap — buckets are slim, index-bounded, and authoritative as of Plan
// 02/03) and delegate the JS folding here. Keeping the math here is what flips the
// 2 Plan-04 *FromAggregates RED tests GREEN.

import { categoryOf, outcomeOf } from "./lib/sankeyClassify";

// A slim aggregates bucket row as the analytics queries consume it.
export interface AggBucket {
  bucket_start: number;
  value: number;
  dimensions: unknown;
}

// ---- activityHeatmap ----
//
// "events" buckets carry dimensions { event_type } at period "hourly". Each
// bucket_start (UTC epoch seconds) maps to a {day, hour} cell via
// new Date(bucket_start*1000).getDay()/.getHours() — IDENTICAL to the pre-rollup
// raw-scan mapping (Pitfall 4: preserve UTC-local semantics, add no timezone
// logic). Counts are summed across all event_type dimensions for the same
// absolute hour into one cell.
export function heatmapFromAggregates(buckets: AggBucket[]): {
  cells: Array<{ day: number; hour: number; count: number }>;
  maxCount: number;
} {
  const cells: Record<string, number> = {};
  let maxCount = 0;

  for (const b of buckets) {
    const d = new Date(b.bucket_start * 1000);
    const day = d.getDay(); // 0=Sun … 6=Sat (matches the old raw-scan mapping)
    const hour = d.getHours();
    const key = `${day}-${hour}`;
    cells[key] = (cells[key] ?? 0) + b.value;
    if (cells[key] > maxCount) maxCount = cells[key];
  }

  return {
    cells: Object.entries(cells).map(([key, count]) => {
      const [day, hour] = key.split("-").map(Number);
      return { day, hour, count };
    }),
    maxCount: maxCount || 1,
  };
}

// ---- errorRateTrend ----
//
// Reads the SAME "events" buckets, keeps only the error event_types
// (Error, ToolError, PostToolUseFailure — D-08), and folds them into 24 hourly
// slots relative to `dayAgo`. All 24 slots are initialised to 0 BEFORE filling
// (Pitfall 7) so an hour with no error buckets renders errors: 0 — never absent.
const ERROR_EVENT_TYPES = new Set(["Error", "ToolError", "PostToolUseFailure"]);

export function errorRateTrendFromAggregates(
  dayAgo: number,
  buckets: AggBucket[]
): Array<{ hour: number; label: string; errors: number }> {
  const counts: Record<number, number> = {};
  for (let h = 0; h < 24; h++) counts[h] = 0; // init-to-0 guard (Pitfall 7)

  for (const b of buckets) {
    const eventType = (b.dimensions as { event_type?: string } | null)?.event_type;
    if (!eventType || !ERROR_EVENT_TYPES.has(eventType)) continue;
    const h = Math.floor((b.bucket_start - dayAgo) / 3600);
    if (h >= 0 && h < 24) counts[h] += b.value;
  }

  return Object.entries(counts).map(([hour, errors]) => ({
    hour: Number(hour),
    label: `${24 - Number(hour)}h ago`,
    errors,
  }));
}

// ---- toolFlowSankey ----
//
// "sankey_edge" buckets carry dimensions { source, target } at period "hourly"
// (two edges per event, written at ingest time using the SAME categoryOf/outcomeOf
// classifier — Pitfall 2 / T-88-09). Read-time reconstruction sums `value` per
// {source, target} edge and derives the node set from the edge endpoints. The
// classifier import above is retained so the read path provably depends on the
// single shared classifier the write path used (no copy-paste divergence).
export function sankeyFromAggregates(buckets: AggBucket[]): {
  nodes: Array<{ name: string }>;
  links: Array<{ source: number; target: number; value: number }>;
} {
  const nodeSet = new Set<string>();
  const linkMap: Record<string, number> = {};

  for (const b of buckets) {
    const dims = b.dimensions as { source?: string; target?: string } | null;
    const source = dims?.source;
    const target = dims?.target;
    if (!source || !target) continue;
    nodeSet.add(source);
    nodeSet.add(target);
    const key = `${source}::${target}`;
    linkMap[key] = (linkMap[key] ?? 0) + b.value;
  }

  const nodes = [...nodeSet];
  const nodeIndex = Object.fromEntries(nodes.map((n, i) => [n, i]));

  const links = Object.entries(linkMap).map(([key, value]) => {
    const [source, target] = key.split("::");
    return { source: nodeIndex[source], target: nodeIndex[target], value };
  });

  return {
    nodes: nodes.map((name) => ({ name })),
    links,
  };
}

// Re-export the classifier so callers (and the sankey reconstruction's provenance)
// resolve through this module's single import of the shared classifier.
export { categoryOf, outcomeOf };

// ---- tokenSunburst ----
//
// Two bucket streams, both keyed by dimensions { provider, model, billingType,
// goalId } at period "hourly":
//   - "cost" buckets (value = summed cost)   → totalCost
//   - "tokens" buckets (value = summed totalTokens, Phase 88 token-fidelity
//     follow-up) → the per-provider/model token counts the UI renders.
//
// The TokenSunburst.tsx contract reads provider.value (Tokens column) and
// model.value (Tokens column) plus top-level totalTokens/totalCost. So the tree
// sets provider.value = sum of that provider's model tokens, model.value = that
// model's token count, and totalTokens = grand sum of token values. totalCost is
// kept as the sum of the cost buckets (separate, informational header).
export function sunburstFromAggregates(
  costBuckets: AggBucket[],
  tokenBuckets: AggBucket[]
): {
  tree: {
    name: string;
    children: Array<{
      name: string;
      value: number;
      children: Array<{ name: string; value: number }>;
    }>;
  };
  totalCost: number;
  totalTokens: number;
} {
  let totalCost = 0;
  for (const b of costBuckets) totalCost += b.value ?? 0;

  // Group token buckets by provider → model, summing token counts.
  let totalTokens = 0;
  const grouped: Record<string, Record<string, number>> = {};
  for (const b of tokenBuckets) {
    const dims = b.dimensions as { provider?: string; model?: string } | null;
    const provider = dims?.provider ?? "unknown";
    const model = dims?.model ?? "unknown";
    const tokens = b.value ?? 0;
    totalTokens += tokens;
    if (!grouped[provider]) grouped[provider] = {};
    grouped[provider][model] = (grouped[provider][model] ?? 0) + tokens;
  }

  const tree = {
    name: "All Providers",
    children: Object.entries(grouped).map(([provider, models]) => {
      const modelChildren = Object.entries(models).map(([model, tokens]) => ({
        name: model,
        value: tokens,
      }));
      return {
        name: provider,
        // provider.value = sum of its model tokens (TokenSunburst.tsx contract)
        value: modelChildren.reduce((sum, m) => sum + m.value, 0),
        children: modelChildren,
      };
    }),
  };

  return { tree, totalCost, totalTokens };
}
