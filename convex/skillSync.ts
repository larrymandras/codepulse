// Pure helpers for skill registry sync — unit-tested in isolation (no Convex ctx).

export type SkillRow = { _id: string; name: string; origin?: string | null };
export type IncomingSkill = { name: string; origin?: string | null };

/** Normalize a possibly-missing origin to a stable, non-empty string. */
export function normalizeOrigin(origin?: string | null): string {
  const o = (origin ?? "").trim();
  return o.length > 0 ? o : "unknown";
}

/**
 * Decide which existing skill rows to delete given an incoming snapshot.
 * Pruning is PER-ORIGIN: only origins present in the incoming snapshot are
 * eligible, and within each such origin only names absent from that origin's
 * incoming set are removed. Origins not present in the snapshot are untouched,
 * so other feeders' skills survive.
 */
export function computeSkillPrunes<T extends SkillRow>(
  existing: T[],
  incoming: IncomingSkill[]
): T[] {
  const incomingByOrigin = new Map<string, Set<string>>();
  for (const s of incoming) {
    const o = normalizeOrigin(s.origin);
    if (!incomingByOrigin.has(o)) incomingByOrigin.set(o, new Set());
    incomingByOrigin.get(o)!.add(s.name);
  }
  const prunes: T[] = [];
  for (const row of existing) {
    const o = normalizeOrigin(row.origin);
    const names = incomingByOrigin.get(o);
    if (!names) continue; // origin not in this snapshot → untouched
    if (!names.has(row.name)) prunes.push(row);
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
    g.discoveredAt = Math.min(g.discoveredAt, r.discoveredAt);
    g.useCount += r.useCount ?? 0;
    if (r.lastUsedAt != null && (g.lastUsedAt == null || r.lastUsedAt > g.lastUsedAt)) {
      g.lastUsedAt = r.lastUsedAt;
    }
  }
  for (const g of byName.values()) g.origins.sort();
  return [...byName.values()];
}
