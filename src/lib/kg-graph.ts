/**
 * Temporal-KG graph transform — pure data layer (Phase 74, KG-07).
 *
 * Framework-free: imports nothing from React or the graph library. Turns the
 * three KG API response shapes into a uniform render model:
 *
 *   API payload (overview | entity | contradictions)
 *     → normalizeX(...) → KgPayload { entities, triples }
 *     → toGraphData(payload) → { nodes, links } for react-force-graph-2d
 *
 * Encoding rules (from the design spec):
 *   - Node = entity, colored by `entityType` (10 stable colors + legend), sized
 *     by degree.
 *   - Edge = entity→entity triple ONLY (`objectId` present): directed
 *     subject→object, label = predicate, width ∝ confidence, current
 *     (`validTo === null`) solid / superseded dashed+dim, `contradictionFlag` red.
 *   - Literal-object triples (`objectId` null, `objectLiteral` set) are NOT graph
 *     elements — they are attributes attached to the subject node (rendered in the
 *     details panel), keeping the graph a clean entity-relationship view.
 */
import type {
  KgContradictionsResponse,
  KgEntity,
  KgEntityResponse,
  KgOverviewResponse,
  KgTriple,
} from "./kgApi";

// ── Uniform payload (lens-agnostic) ────────────────────────────────────────

export interface KgPayload {
  entities: KgEntity[];
  triples: KgTriple[];
  meta?: { truncated?: boolean; total?: number; asOf?: string | null };
}

// ── Render model ─────────────────────────────────────────────────────────────

export interface KgNode {
  id: string; // entity UUID
  name: string;
  entityType: string;
  agentId: string;
  /** force-graph size, scaled from degree. */
  val: number;
  degree: number;
  color: string;
  /** literal-object facts about this entity (predicate = objectLiteral). */
  attributes: KgAttribute[];
  /** true when this node was synthesized from a triple endpoint (no entity row). */
  synthetic: boolean;
}

export interface KgAttribute {
  predicate: string;
  value: string;
  confidence: number | null;
  validFrom: string | null;
  validTo: string | null;
  contradictionFlag: boolean;
  sourceTripleId: string;
  /** episodic event id (provenance), when the API serializes it. */
  sourceEventId?: string | null;
}

export interface KgLink {
  id: string;
  source: string; // subjectId
  target: string; // objectId
  predicate: string;
  confidence: number | null;
  /** styling width ∝ confidence (1..6px). */
  width: number;
  /** true when validTo === null. */
  current: boolean;
  contradictionFlag: boolean;
  validFrom: string | null;
  validTo: string | null;
  agentId: string;
  /** episodic event id (provenance), when the API serializes it. */
  sourceEventId?: string | null;
}

export interface KgGraphData {
  nodes: KgNode[];
  links: KgLink[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    attributeCount: number;
    currentEdges: number;
    supersededEdges: number;
    contradictionEdges: number;
  };
}

// ── Type colors: 10 stable colors keyed off a normalized entity type ─────────
// Phase 71 token-aligned (emerald primary anchor + a distinct categorical ramp).
// Order is fixed so a given type always maps to the same color across lenses.

export const ENTITY_TYPE_COLORS: { type: string; color: string }[] = [
  { type: "person", color: "#10b981" }, // emerald — primary
  { type: "organization", color: "#3b82f6" }, // info blue
  { type: "project", color: "#a78bfa" }, // violet
  { type: "place", color: "#f59e0b" }, // amber
  { type: "concept", color: "#22d3ee" }, // cyan
  { type: "event", color: "#f472b6" }, // pink
  { type: "product", color: "#84cc16" }, // lime
  { type: "tool", color: "#fb7185" }, // rose
  { type: "document", color: "#c084fc" }, // purple
  { type: "other", color: "#94a3b8" }, // slate — fallback
];

const FALLBACK_COLOR =
  ENTITY_TYPE_COLORS[ENTITY_TYPE_COLORS.length - 1].color;

const _colorByType = new Map(
  ENTITY_TYPE_COLORS.map((c) => [c.type, c.color]),
);

/** Normalize a raw entity_type to one of the 10 stable buckets. */
export function normalizeEntityType(raw: string | null | undefined): string {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t) return "other";
  if (_colorByType.has(t)) return t;
  // Common synonyms → canonical bucket.
  if (t === "org" || t === "company" || t === "team") return "organization";
  if (t === "location" || t === "city" || t === "country") return "place";
  if (t === "topic" || t === "idea") return "concept";
  if (t === "file" || t === "note") return "document";
  if (t === "human" || t === "user" || t === "contact") return "person";
  return "other";
}

export function entityTypeColor(raw: string | null | undefined): string {
  return _colorByType.get(normalizeEntityType(raw)) ?? FALLBACK_COLOR;
}

// ── Normalizers: API responses → uniform KgPayload ───────────────────────────

/**
 * Overview entities carry their relationships inline. We flatten the nested
 * triples into one `triples` list (deduped by id) and keep the entity rows.
 */
export function normalizeOverview(resp: KgOverviewResponse): KgPayload {
  const entities: KgEntity[] = resp.entities.map((e) => ({
    id: e.id,
    name: e.name,
    entityType: e.entityType,
    agentId: e.agentId,
  }));
  const seen = new Set<string>();
  const triples: KgTriple[] = [];
  for (const e of resp.entities) {
    for (const t of e.relationships ?? []) {
      if (t.id && seen.has(t.id)) continue;
      if (t.id) seen.add(t.id);
      triples.push(t);
    }
  }
  return {
    entities,
    triples,
    meta: { truncated: resp.truncated, total: resp.total, asOf: resp.asOf },
  };
}

/**
 * The entity (ego) endpoint returns the focused entity + its triples but no rows
 * for the *neighbor* entities. We synthesize minimal entity rows for any subject
 * or object id referenced by a triple so the graph has both endpoints.
 */
export function normalizeEntity(resp: KgEntityResponse): KgPayload {
  const entities: KgEntity[] = [];
  if (resp.entity) {
    entities.push({
      id: resp.entity.id,
      name: resp.entity.name,
      entityType: "person", // ego focus default; neighbor types unknown from this endpoint
      agentId: "",
    });
  }
  return {
    entities,
    triples: resp.triples ?? [],
    meta: { asOf: resp.asOf },
  };
}

/** Contradictions returns a flat triple list; neighbor entities are synthesized. */
export function normalizeContradictions(
  resp: KgContradictionsResponse,
): KgPayload {
  return { entities: [], triples: resp.contradictions ?? [] };
}

// ── Width / size helpers ─────────────────────────────────────────────────────

const MIN_EDGE_WIDTH = 1;
const MAX_EDGE_WIDTH = 6;
const MIN_NODE_SIZE = 3;
const MAX_NODE_SIZE = 18;

/** confidence (0..1) → edge width (1..6). Missing confidence → mid width. */
export function confidenceToWidth(confidence: number | null): number {
  const c = confidence == null ? 0.5 : Math.max(0, Math.min(1, confidence));
  return MIN_EDGE_WIDTH + c * (MAX_EDGE_WIDTH - MIN_EDGE_WIDTH);
}

/** Log-scaled node size by degree so a hub isn't astronomically large. */
function degreeToSize(degree: number, maxDegree: number): number {
  if (degree <= 0 || maxDegree <= 0) return MIN_NODE_SIZE;
  const ratio = Math.log1p(degree) / Math.log1p(maxDegree);
  return MIN_NODE_SIZE + ratio * (MAX_NODE_SIZE - MIN_NODE_SIZE);
}

// ── toGraphData: uniform payload → {nodes, links} ────────────────────────────

export function toGraphData(payload: KgPayload): KgGraphData {
  // 1. Index known entities; we may synthesize more from triple endpoints.
  const nodeById = new Map<string, KgNode>();
  const upsertNode = (
    id: string,
    seed?: { name?: string; entityType?: string | null; agentId?: string },
    synthetic = false,
  ): KgNode => {
    let n = nodeById.get(id);
    if (!n) {
      const et = normalizeEntityType(seed?.entityType);
      n = {
        id,
        name: seed?.name ?? id,
        entityType: et,
        agentId: seed?.agentId ?? "",
        val: MIN_NODE_SIZE,
        degree: 0,
        color: entityTypeColor(et),
        attributes: [],
        synthetic,
      };
      nodeById.set(id, n);
    } else if (synthetic === false && seed?.name && n.synthetic) {
      // A real entity row supersedes a previously-synthesized placeholder.
      n.name = seed.name;
      n.entityType = normalizeEntityType(seed.entityType);
      n.color = entityTypeColor(n.entityType);
      n.agentId = seed.agentId ?? n.agentId;
      n.synthetic = false;
    }
    return n;
  };

  for (const e of payload.entities) {
    upsertNode(e.id, e, false);
  }

  // 2. Walk triples: entity→entity become links; literal facts become attributes.
  const links: KgLink[] = [];
  let attributeCount = 0;
  let currentEdges = 0;
  let supersededEdges = 0;
  let contradictionEdges = 0;

  for (const t of payload.triples) {
    const isEntityEdge = !!t.objectId;
    if (isEntityEdge) {
      // Ensure both endpoints exist (synthesize neighbors not in entity rows).
      if (t.subjectId) upsertNode(t.subjectId, undefined, true);
      upsertNode(t.objectId!, undefined, true);
      if (!t.subjectId) continue; // malformed edge — skip
      const current = t.validTo === null;
      if (current) currentEdges++;
      else supersededEdges++;
      if (t.contradictionFlag) contradictionEdges++;
      links.push({
        id: t.id,
        source: t.subjectId,
        target: t.objectId!,
        predicate: t.predicate,
        confidence: t.confidence,
        width: confidenceToWidth(t.confidence),
        current,
        contradictionFlag: t.contradictionFlag,
        validFrom: t.validFrom,
        validTo: t.validTo,
        agentId: t.agentId,
        sourceEventId: t.sourceEventId ?? null,
      });
      nodeById.get(t.subjectId)!.degree += 1;
      nodeById.get(t.objectId!)!.degree += 1;
    } else if (t.objectLiteral != null && t.subjectId) {
      // Literal fact → attribute on the subject node.
      const subj = upsertNode(t.subjectId, undefined, true);
      subj.attributes.push({
        predicate: t.predicate,
        value: t.objectLiteral,
        confidence: t.confidence,
        validFrom: t.validFrom,
        validTo: t.validTo,
        contradictionFlag: t.contradictionFlag,
        sourceTripleId: t.id,
        sourceEventId: t.sourceEventId ?? null,
      });
      attributeCount++;
    }
  }

  // 3. Size nodes by degree.
  const nodes = [...nodeById.values()];
  const maxDegree = Math.max(1, ...nodes.map((n) => n.degree));
  for (const n of nodes) n.val = degreeToSize(n.degree, maxDegree);

  return {
    nodes,
    links,
    stats: {
      nodeCount: nodes.length,
      edgeCount: links.length,
      attributeCount,
      currentEdges,
      supersededEdges,
      contradictionEdges,
    },
  };
}

// ── deriveView: client-side filtering (type / predicate / agent) ─────────────

export interface KgViewFilters {
  entityTypes?: string[] | null; // normalized types to KEEP (null/empty = all)
  predicates?: string[] | null; // predicates to KEEP (null/empty = all)
  agentId?: string | null; // keep only triples for this agent (null = all)
}

/**
 * Pure client-side filter over an already-built graph. Temporal state is
 * server-side (the `asOf` fetch re-queries) — this only narrows the rendered
 * view by entity type, predicate, and agent. Drops links whose endpoints are
 * filtered out and prunes nodes left with no edges *only* when an entity-type
 * filter is active (so an explicit single-entity ego view still shows its node).
 */
export function deriveView(
  graph: KgGraphData,
  filters: KgViewFilters,
): KgGraphData {
  const typeSet =
    filters.entityTypes && filters.entityTypes.length
      ? new Set(filters.entityTypes.map(normalizeEntityType))
      : null;
  const predSet =
    filters.predicates && filters.predicates.length
      ? new Set(filters.predicates)
      : null;
  const agent = filters.agentId || null;

  if (!typeSet && !predSet && !agent) return graph;

  let nodes = graph.nodes.filter((n) => !typeSet || typeSet.has(n.entityType));
  const keptIds = new Set(nodes.map((n) => n.id));

  const links = graph.links.filter((l) => {
    if (predSet && !predSet.has(l.predicate)) return false;
    if (agent && l.agentId !== agent) return false;
    return keptIds.has(l.source) && keptIds.has(l.target);
  });

  // When a type filter is active, prune now-isolated synthetic placeholders so
  // the view doesn't show dangling neighbor stubs with no surviving edges.
  if (typeSet) {
    const connected = new Set<string>();
    for (const l of links) {
      connected.add(l.source);
      connected.add(l.target);
    }
    nodes = nodes.filter((n) => !n.synthetic || connected.has(n.id));
  }

  return {
    nodes,
    links,
    stats: {
      nodeCount: nodes.length,
      edgeCount: links.length,
      attributeCount: nodes.reduce((s, n) => s + n.attributes.length, 0),
      currentEdges: links.filter((l) => l.current).length,
      supersededEdges: links.filter((l) => !l.current).length,
      contradictionEdges: links.filter((l) => l.contradictionFlag).length,
    },
  };
}

// ── Neighbor / focus helpers (for ego highlighting + click focus) ────────────

/** All node ids directly connected to `nodeId` (either direction). */
export function getNeighbors(graph: KgGraphData, nodeId: string): Set<string> {
  const out = new Set<string>();
  for (const l of graph.links) {
    if (l.source === nodeId) out.add(l.target);
    if (l.target === nodeId) out.add(l.source);
  }
  return out;
}

/**
 * The focus set for a selection: the node itself + its neighbors. Used to dim
 * everything else. Returns null for no selection (→ nothing dimmed).
 */
export function computeFocusSet(
  graph: KgGraphData,
  selectedId: string | null,
): Set<string> | null {
  if (!selectedId) return null;
  const set = getNeighbors(graph, selectedId);
  set.add(selectedId);
  return set;
}

/** Distinct predicates present in a graph (sorted) — for the predicate filter. */
export function derivePredicates(graph: KgGraphData): string[] {
  const set = new Set<string>();
  for (const l of graph.links) set.add(l.predicate);
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Distinct normalized entity types present (sorted) — for the type legend/filter. */
export function deriveEntityTypes(graph: KgGraphData): string[] {
  const set = new Set<string>();
  for (const n of graph.nodes) set.add(n.entityType);
  return [...set].sort((a, b) => a.localeCompare(b));
}
