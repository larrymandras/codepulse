// Pure helpers for skill registry sync — unit-tested in isolation (no Convex ctx).

export type SkillRow = { _id: string; name: string; origin?: string | null };
export type IncomingSkill = { name: string; origin?: string | null };

/**
 * Larger of two optional numbers; undefined only when both are.
 * Used to merge `useCount`/`lastUsedAt`, which have two independent writers
 * (the host scanner's usage log, and recordSkillLaunch from dashboard clicks).
 */
export function maxDefined(a?: number, b?: number): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return a > b ? a : b;
}

/** Normalize a possibly-missing origin to a stable, non-empty string. */
export function normalizeOrigin(origin?: string | null): string {
  const o = (origin ?? "").trim();
  return o.length > 0 ? o : "unknown";
}

/**
 * Guard an untrusted snapshot's `scannedOrigins` before it can act as a
 * prune-authorizing manifest (the /scan snapshot body is `v.any()`). Only a
 * real array passes through; any other shape falls back to `undefined` — the
 * legacy incoming-origins-only prune path (98-05 GC-03). Without this, a
 * truthy non-iterable (`{}`, `42`) would throw inside computeSkillPrunes and
 * roll back the entire sync, and a string would iterate per-character into
 * bogus one-char origins.
 */
export function sanitizeScannedOrigins(
  value: unknown
): Array<string | null | undefined> | undefined {
  return Array.isArray(value) ? value : undefined;
}

/**
 * Guard an untrusted snapshot's `scannedOriginsComplete` before it can engage
 * the strict/exhaustive prune mode (DEBT-05, D-03). Only a literal boolean
 * `true` counts — a truthy string (`"true"`), a truthy number (`1`), or an
 * object (`{}`) must NOT engage the strict path, because `snapshot` is
 * `v.any()` and a hostile or merely malformed producer could otherwise set
 * something that *looks* affirmative without meaning it. Anything other than
 * exactly `true` degrades to `false`, which keeps `computeSkillPrunes` on its
 * legacy/additive behavior — this is what stops a malformed or hostile
 * snapshot from silently making origins unprunable, or from silently
 * widening deletion authority it never earned.
 */
export function sanitizeScannedOriginsComplete(value: unknown): boolean {
  return value === true;
}

/**
 * Decide which existing skill rows to delete given an incoming snapshot.
 * Pruning is PER-ORIGIN, and has three modes:
 *
 * 1. Legacy (no `scannedOrigins`): only origins PRESENT IN `incoming` are
 *    eligible for pruning, and within each such origin only names absent from
 *    that origin's incoming set are removed. Origins not present in the
 *    snapshot are untouched, so other feeders' skills survive. This is the
 *    byte-identical fallback every other mode degrades to on malformed input.
 *
 * 2. Additive manifest (`scannedOrigins` present, `scannedOriginsComplete`
 *    absent/false — 98-05 gap closure): the producer declares which origins
 *    it actually COVERED on this scan — home roots plus every reachable
 *    workspace, including one whose skills dir is now empty. Any declared
 *    origin becomes eligible for pruning even when it has ZERO incoming
 *    skills (all its rows are removed), which is exactly the
 *    "moved/deleted the last skill out of a project" case. The declared set
 *    is UNIONED with the incoming origins — PERMISSIVE: it only ever adds
 *    prunable origins beyond incoming presence, never removes any.
 *
 * 3. Exhaustive manifest (`scannedOrigins` present AND
 *    `scannedOriginsComplete === true` — DEBT-05, D-03): the producer asserts
 *    its declaration is the COMPLETE set of origins it covered this scan —
 *    nothing else may be treated as prunable, even an origin present in
 *    `incoming`. The prunable-origin set becomes the declared set ALONE —
 *    RESTRICTIVE: it can only narrow what's eligible for pruning relative to
 *    the legacy/additive modes, never widen it. This is what protects an
 *    origin the producer does not control or did not enumerate (e.g. a
 *    `claude-code:plugin` read that silently failed) from being pruned by a
 *    scan that never actually saw it. An origin absent from both `incoming`
 *    and an exhaustive `scannedOrigins` remains untouched, same as always.
 *    See `computePruneRefusals` below for naming exactly what mode 3 protects.
 */
export function computeSkillPrunes<T extends SkillRow>(
  existing: T[],
  incoming: IncomingSkill[],
  scannedOrigins?: Array<string | null | undefined>,
  scannedOriginsComplete?: boolean
): T[] {
  const incomingByOrigin = new Map<string, Set<string>>();
  for (const s of incoming) {
    const o = normalizeOrigin(s.origin);
    if (!incomingByOrigin.has(o)) incomingByOrigin.set(o, new Set());
    incomingByOrigin.get(o)!.add(s.name);
  }

  // Prunable-origin set. Exhaustive mode (D-03): the declared set ALONE,
  // never seeded from incoming — restrictive. Otherwise: legacy (undefined
  // manifest) is exactly the incoming origins, byte-for-byte preserving
  // today's behavior; additive manifest unions the declared set in so a
  // declared-but-empty origin becomes eligible too.
  let prunableOrigins: Set<string>;
  if (scannedOriginsComplete === true && scannedOrigins !== undefined) {
    prunableOrigins = new Set<string>();
    for (const o of scannedOrigins) prunableOrigins.add(normalizeOrigin(o));
  } else {
    prunableOrigins = new Set<string>(incomingByOrigin.keys());
    if (scannedOrigins) {
      for (const o of scannedOrigins) prunableOrigins.add(normalizeOrigin(o));
    }
  }

  const prunes: T[] = [];
  for (const row of existing) {
    const o = normalizeOrigin(row.origin);
    if (!prunableOrigins.has(o)) continue; // origin not scanned/declared → untouched
    const names = incomingByOrigin.get(o);
    if (!names || !names.has(row.name)) prunes.push(row);
  }
  return prunes;
}

/**
 * The rows a refused-exhaustive-mode prune PROTECTED — i.e. exactly the set
 * difference between what the legacy/additive rule would have deleted and
 * what the (possibly exhaustive) rule actually deletes. Grouped by origin so
 * a caller can write one `alerts` row per protected origin (D-05).
 *
 * Pure and total: never throws, issues no I/O. Returns `[]` whenever the
 * strict/exhaustive path is not engaged — there is nothing to compare against
 * when the legacy and strict verdicts are the same computation.
 */
export function computePruneRefusals<T extends SkillRow>(
  existing: T[],
  incoming: IncomingSkill[],
  scannedOrigins?: Array<string | null | undefined>,
  scannedOriginsComplete?: boolean
): Array<{ origin: string; protectedCount: number; sampleNames: string[] }> {
  if (scannedOriginsComplete !== true || scannedOrigins === undefined) return [];

  const legacyPrunes = computeSkillPrunes(existing, incoming, scannedOrigins, undefined);
  const strictPrunes = computeSkillPrunes(existing, incoming, scannedOrigins, scannedOriginsComplete);
  const strictPrunedIds = new Set(strictPrunes.map((r) => r._id));

  const protectedByOrigin = new Map<string, T[]>();
  for (const row of legacyPrunes) {
    if (strictPrunedIds.has(row._id)) continue; // still pruned under the strict rule — not a refusal
    const o = normalizeOrigin(row.origin);
    if (!protectedByOrigin.has(o)) protectedByOrigin.set(o, []);
    protectedByOrigin.get(o)!.push(row);
  }

  const result = [...protectedByOrigin.entries()].map(([origin, rows]) => ({
    origin,
    protectedCount: rows.length,
    sampleNames: rows.slice(0, 5).map((r) => r.name),
  }));
  result.sort((a, b) => a.origin.localeCompare(b.origin));
  return result;
}

export type GroupedSkill = {
  name: string;
  origins: string[];
  description?: string;
  source?: string;
  discoveredAt: number;
  useCount: number;
  lastUsedAt?: number;
  upstream?: string;
  command?: string;
};

/** Collapse (name, origin) rows into one entry per name for display. */
export function groupSkillRowsByName(
  rows: Array<{
    name: string;
    origin?: string | null;
    description?: string;
    source?: string;
    discoveredAt: number;
    useCount?: number;
    lastUsedAt?: number;
    upstream?: string;
    command?: string;
  }>
): GroupedSkill[] {
  const byName = new Map<string, GroupedSkill>();
  for (const r of rows) {
    let g = byName.get(r.name);
    if (!g) {
      g = { name: r.name, origins: [], discoveredAt: r.discoveredAt, useCount: 0 };
      byName.set(r.name, g);
    }
    const o = normalizeOrigin(r.origin);
    if (!g.origins.includes(o)) g.origins.push(o);
    if (!g.description && r.description) g.description = r.description;
    if (!g.source && r.source) g.source = r.source;
    // A known upstream beats "unknown": prefer the row that actually records one.
    if (r.upstream && r.upstream !== "unknown" && (!g.upstream || g.upstream === "unknown")) {
      g.upstream = r.upstream;
    } else if (!g.upstream && r.upstream) {
      g.upstream = r.upstream;
    }
    if (!g.command && r.command) g.command = r.command;
    g.discoveredAt = Math.min(g.discoveredAt, r.discoveredAt);
    g.useCount += r.useCount ?? 0;
    if (r.lastUsedAt != null && (g.lastUsedAt == null || r.lastUsedAt > g.lastUsedAt)) {
      g.lastUsedAt = r.lastUsedAt;
    }
  }
  for (const g of byName.values()) g.origins.sort();
  return [...byName.values()];
}
