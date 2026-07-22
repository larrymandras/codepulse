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
 * Decide which existing skill rows to delete given an incoming snapshot.
 * Pruning is PER-ORIGIN.
 *
 * Without `scannedOrigins` (legacy/backward-compatible path): only origins
 * PRESENT IN `incoming` are eligible for pruning, and within each such origin
 * only names absent from that origin's incoming set are removed. Origins not
 * present in the snapshot are untouched, so other feeders' skills survive.
 *
 * With `scannedOrigins` (manifest-driven path, 98-05 gap closure): the
 * producer declares which origins it actually COVERED on this scan — home
 * roots plus every reachable workspace, including one whose skills dir is now
 * empty. Any declared origin becomes eligible for pruning even when it has
 * ZERO incoming skills (all its rows are removed), which is exactly the
 * "moved/deleted the last skill out of a project" case. An origin that is
 * neither in `incoming` nor in `scannedOrigins` (e.g. an unreachable/unmounted
 * workspace, deliberately never declared) remains untouched — the manifest is
 * additive, never more permissive than incoming presence for undeclared origins.
 */
export function computeSkillPrunes<T extends SkillRow>(
  existing: T[],
  incoming: IncomingSkill[],
  scannedOrigins?: Array<string | null | undefined>
): T[] {
  const incomingByOrigin = new Map<string, Set<string>>();
  for (const s of incoming) {
    const o = normalizeOrigin(s.origin);
    if (!incomingByOrigin.has(o)) incomingByOrigin.set(o, new Set());
    incomingByOrigin.get(o)!.add(s.name);
  }

  // Prunable-origin set: legacy (undefined manifest) path is exactly the
  // incoming origins, byte-for-byte preserving today's behavior. When a
  // manifest is provided, it's unioned in so a declared-but-empty origin
  // becomes eligible too.
  const prunableOrigins = new Set<string>(incomingByOrigin.keys());
  if (scannedOrigins) {
    for (const o of scannedOrigins) prunableOrigins.add(normalizeOrigin(o));
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
