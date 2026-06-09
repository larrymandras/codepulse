/**
 * Pure transforms for the Unified Graph Hub (Phase 76, HUB-01).
 *
 * Ástríðr's Phase 137 `graph_snapshot` telemetry event carries a whole
 * graphify-out / Obsidian-vault graph. CodePulse stores it idempotently
 * (one row per `snapshotId`) and renders it through the shared
 * `ForceGraphCanvas`. This module owns the *pure* shaping logic — defensive
 * normalization of the wire event, `source` classification (graphify-repo vs
 * vault), and source-filtering — so it can be unit-tested without Convex or a
 * canvas.
 *
 * Be defensive at the wire boundary: accept camelCase OR snake_case, tolerate
 * missing optional fields, and never throw on a malformed node/link (drop it).
 */

export interface SnapshotNode {
  id: string;
  label: string;
  type: string;
  community?: number;
  /** Origin namespace: "graphify:<repo>:" or "vault:". */
  source: string;
}

export interface SnapshotLink {
  source: string;
  target: string;
  relation: string;
}

export interface GraphSnapshot {
  snapshotId: string;
  nodes: SnapshotNode[];
  links: SnapshotLink[];
  /** Emitter-supplied snapshot time (epoch seconds). */
  snapshotTimestamp: number;
}

/** A node's broad origin family, derived from its `source` namespace. */
export type SourceKind = "graphify" | "vault" | "other";

/**
 * Classify a node `source` string into a broad family.
 *   "graphify:codepulse:"  → "graphify"
 *   "vault:"               → "vault"
 *   anything else / empty  → "other"
 */
export function classifySource(source: string | undefined | null): SourceKind {
  const s = (source ?? "").toLowerCase();
  if (s.startsWith("graphify:")) return "graphify";
  if (s.startsWith("vault:")) return "vault";
  return "other";
}

/**
 * Extract the human-readable repo/vault label from a `source` namespace.
 *   "graphify:codepulse:" → "codepulse"
 *   "vault:"              → "vault"
 *   "graphify::"          → "graphify"
 */
export function sourceLabel(source: string | undefined | null): string {
  const s = (source ?? "").trim();
  if (!s) return "unknown";
  const parts = s.split(":").filter((p) => p.length > 0);
  if (parts.length >= 2) return parts[1]; // graphify:<repo>:
  return parts[0] ?? "unknown"; // vault:
}

function coerceString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function coerceNumber(...vals: unknown[]): number | undefined {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}

/**
 * Normalize one raw wire node into a `SnapshotNode`, or `null` if it lacks an
 * `id` (an un-keyable node is unusable in a force graph). camelCase wins;
 * snake_case is accepted as a fallback.
 */
export function normalizeNode(raw: any): SnapshotNode | null {
  if (!raw || typeof raw !== "object") return null;
  const id = coerceString(raw.id, raw.node_id, raw.nodeId);
  if (!id) return null;
  return {
    id,
    label: coerceString(raw.label, raw.name) ?? id,
    type: coerceString(raw.type, raw.node_type, raw.nodeType, raw.group) ?? "node",
    community: coerceNumber(raw.community),
    source: coerceString(raw.source, raw.namespace) ?? "",
  };
}

/**
 * Normalize one raw wire link into a `SnapshotLink`, or `null` if either
 * endpoint is missing.
 */
export function normalizeLink(raw: any): SnapshotLink | null {
  if (!raw || typeof raw !== "object") return null;
  const source = coerceString(raw.source, raw.from, raw.src);
  const target = coerceString(raw.target, raw.to, raw.dst);
  if (!source || !target) return null;
  return {
    source,
    target,
    relation:
      coerceString(raw.relation, raw.rel, raw.type, raw.label) ?? "links",
  };
}

/**
 * Map a raw `graph_snapshot` event payload into the persisted snapshot shape.
 * Defensive: accepts camelCase OR snake_case keys, drops malformed
 * nodes/links, and stamps `snapshotTimestamp` from the event (fallback: now).
 *
 * Returns `null` when there is no usable `snapshotId` — without a stable
 * idempotency key we cannot upsert, so the caller should skip.
 */
export function mapGraphSnapshot(
  data: any,
  fallbackTs: number,
): {
  snapshotId: string;
  nodes: SnapshotNode[];
  links: SnapshotLink[];
  snapshotTimestamp: number;
} | null {
  if (!data || typeof data !== "object") return null;
  const snapshotId = coerceString(
    data.snapshotId,
    data.snapshot_id,
    data.id,
  );
  if (!snapshotId) return null;

  const rawNodes = Array.isArray(data.nodes) ? data.nodes : [];
  const rawLinks = Array.isArray(data.links)
    ? data.links
    : Array.isArray(data.edges)
      ? data.edges
      : [];

  const nodes: SnapshotNode[] = [];
  for (const n of rawNodes) {
    const node = normalizeNode(n);
    if (node) nodes.push(node);
  }

  // Drop links whose endpoints aren't present in the node set — a dangling
  // edge renders as a phantom node in react-force-graph.
  const ids = new Set(nodes.map((n) => n.id));
  const links: SnapshotLink[] = [];
  for (const l of rawLinks) {
    const link = normalizeLink(l);
    if (link && ids.has(link.source) && ids.has(link.target)) links.push(link);
  }

  return {
    snapshotId,
    nodes,
    links,
    snapshotTimestamp:
      coerceNumber(data.timestamp, data.snapshotTimestamp) ?? fallbackTs,
  };
}

/**
 * Filter a snapshot's nodes (and dependent links) to the enabled source
 * families. `enabled` is a set of `SourceKind`s to keep. Links survive only if
 * both endpoints survive.
 */
export function filterBySource(
  snapshot: { nodes: SnapshotNode[]; links: SnapshotLink[] },
  enabled: Set<SourceKind>,
): { nodes: SnapshotNode[]; links: SnapshotLink[] } {
  const nodes = snapshot.nodes.filter((n) =>
    enabled.has(classifySource(n.source)),
  );
  const ids = new Set(nodes.map((n) => n.id));
  const links = snapshot.links.filter(
    (l) => ids.has(l.source) && ids.has(l.target),
  );
  return { nodes, links };
}

/**
 * Summarize the source families present in a snapshot: per-family node counts
 * and the distinct repo/vault labels. Drives the hub legend + toggle chips.
 */
export function summarizeSources(nodes: SnapshotNode[]): {
  graphify: number;
  vault: number;
  other: number;
  repos: string[];
} {
  let graphify = 0;
  let vault = 0;
  let other = 0;
  const repos = new Set<string>();
  for (const n of nodes) {
    const kind = classifySource(n.source);
    if (kind === "graphify") {
      graphify++;
      repos.add(sourceLabel(n.source));
    } else if (kind === "vault") {
      vault++;
    } else {
      other++;
    }
  }
  return { graphify, vault, other, repos: [...repos].sort() };
}
