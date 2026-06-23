/**
 * Temporal-KG read API client (Phase 74).
 *
 * Typed fetchers for Ástríðr's Phase 135 `/api/kg/*` HTTP surface. Every call is
 * Bearer-authed via `authHeaders()` (CLAUDE.md: all /api/* calls require it) and
 * hits `VITE_ASTRIDR_API_URL`. This is the *interactive* path — fetch-on-demand,
 * NOT mirrored into Convex (the always-on summary cards read Convex instead).
 *
 * The response shapes here mirror the LIVE emitter
 * (`astridr/channels/kg_read_api.py`), which differs from the idealized
 * `GraphPayload` in the design spec:
 *   - `/summary` uses `currentTripleCount` / `historicalTripleCount` (NOT
 *     `currentTriples` / `historicalTriples`) and has no `totalEntities`.
 *   - `/overview` returns entities each carrying a nested `relationships` triple
 *     array (NOT a flat top-level `triples` array).
 *   - `/entity` returns `{ entity, triples }`.
 *   - `/contradictions` returns `{ contradictions }`.
 * `kg-graph.ts` normalizes all four into a uniform `{nodes,links}` model.
 *
 * Phase 86 addition — `/search`:
 *   - Consumer-defined shape (see KgSearchParams / KgSearchResponse below).
 *     Ástríðr is the source of truth when live — document known consumer/emitter
 *     divergences here.
 *   - Assumption A2: If Ástríðr returns only `subjectId` (no `subjectName`), the
 *     consumer must reverse-map id → name before calling `buildFocusUrl`. This is
 *     a cross-repo SEED requirement: Ástríðr `/api/kg/search` MUST include
 *     `subjectName` in each hit.
 *   - Open Question 1: Default GET with query params (consistent with kgGet
 *     pattern). If Ástríðr requires POST for long queries that exceed URL limits,
 *     that is a cross-repo SEED detail — document here when known.
 *   - Gate: 404/501 from this endpoint → informational "not deployed" copy in the
 *     UI (D-01). The gate lives in the consumer (KnowledgeGraph.tsx), not here.
 *     kgGet throws AstridrApiError on any non-2xx; the consumer inspects status.
 */
import { authHeaders, astridrApiBase, AstridrApiError } from "./astridrApi";

// ── Wire types (camelCase, exactly as the Python API serializes) ───────────

export interface KgEntity {
  id: string;
  name: string;
  entityType: string | null;
  agentId: string;
}

export interface KgTriple {
  id: string;
  subjectId: string | null;
  predicate: string;
  objectId: string | null;
  objectLiteral: string | null;
  validFrom: string | null;
  validTo: string | null;
  confidence: number | null;
  agentId: string;
  contradictionFlag: boolean;
  /**
   * Episodic-memory event id that taught this fact (provenance deep-link target,
   * KG-06). NOTE: the live Phase 135 `_serialize_triple` does NOT yet emit this
   * — it is optional + forward-compatible so the panel links provenance the
   * moment the Ástríðr API starts serializing `source_event_id`.
   */
  sourceEventId?: string | null;
}

/** `/api/kg/summary` — also pushed as the `kg_summary` telemetry event. */
export interface KgSummary {
  entitiesByType: Record<string, number>;
  currentTripleCount: number;
  historicalTripleCount: number;
  contradictionCount: number;
  lastExtractionAt: string | null;
}

/** An overview entity carries its relationships inline. */
export interface KgOverviewEntity extends KgEntity {
  relationships: KgTriple[];
}

/** `/api/kg/overview` */
export interface KgOverviewResponse {
  entities: KgOverviewEntity[];
  count: number;
  total: number;
  truncated: boolean;
  asOf: string | null;
}

/** `/api/kg/entity` */
export interface KgEntityResponse {
  entity: { id: string; name: string } | null;
  triples: KgTriple[];
  hops: number;
  asOf: string | null;
}

/** `/api/kg/contradictions` */
export interface KgContradictionsResponse {
  contradictions: KgTriple[];
  count: number;
}

// ── Search types (Phase 86, KG-08) ────────────────────────────────────────

/**
 * Params for `/api/kg/search`. Consumer-defined; Ástríðr must conform.
 * snake_case keys match kgGet param-key convention (passed directly to URLSearchParams).
 */
export interface KgSearchParams {
  query: string;
  entity_type?: string | null;
  agent_id?: string | null;
  limit?: number;
}

/**
 * A single full-text search hit from `/api/kg/search`.
 *
 * NOTE (Assumption A2): `subjectName` is required — if Ástríðr only returns
 * `subjectId`, the consumer cannot call `buildFocusUrl` without a reverse-map.
 * Ástríðr MUST include `subjectName` (cross-repo SEED requirement).
 */
export interface KgSearchHit {
  /** Subject entity name — used verbatim as the focus target for result-click (D-02). */
  subjectName: string;
  /** Subject entity id. */
  subjectId: string;
  /** The relationship label / predicate that matched. */
  predicate: string;
  /** The fact text or object literal snippet containing the match. */
  snippet: string;
  /** The matched substring within snippet, for emphasis rendering (font-semibold text-primary). */
  matchedTerm?: string;
  /** Confidence of the underlying triple (optional). */
  confidence?: number | null;
}

/** Response envelope from `/api/kg/search`. */
export interface KgSearchResponse {
  results: KgSearchHit[];
  count: number;
  query: string;
}

// ── Param shapes ───────────────────────────────────────────────────────────

export interface OverviewParams {
  limit?: number;
  entityType?: string | null;
  agentId?: string | null;
  asOf?: string | null;
}

export interface EntityParams {
  name: string;
  hops?: number;
  agentId?: string | null;
  asOf?: string | null;
}

// ── fetch helper (mirrors astridrApi.apiRequest but for the /api/kg surface) ──

/**
 * GET a KG endpoint with auth + query params. Throws `AstridrApiError` on a
 * non-2xx, parsing the FastAPI error envelope (`detail`) when present so the
 * UI can show a real message. Network failures propagate as the raw error.
 */
async function kgGet<T>(
  path: string,
  params?: Record<string, string | number | null | undefined>,
): Promise<T> {
  const url = new URL(`${astridrApiBase()}${path}`, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== null && v !== undefined && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }
  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({ detail: res.statusText }) as { detail?: unknown });
    const detail =
      typeof body.detail === "string" ? body.detail : res.statusText;
    throw new AstridrApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

// ── Public fetchers ──────────────────────────────────────────────────────────

export function fetchSummary(): Promise<KgSummary> {
  return kgGet<KgSummary>("/api/kg/summary");
}

export function fetchOverview(
  params: OverviewParams = {},
): Promise<KgOverviewResponse> {
  return kgGet<KgOverviewResponse>("/api/kg/overview", {
    limit: params.limit,
    entity_type: params.entityType,
    agent_id: params.agentId,
    asOf: params.asOf,
  });
}

export function fetchEntity(params: EntityParams): Promise<KgEntityResponse> {
  return kgGet<KgEntityResponse>("/api/kg/entity", {
    name: params.name,
    hops: params.hops,
    agent_id: params.agentId,
    asOf: params.asOf,
  });
}

export function fetchContradictions(
  limit?: number,
): Promise<KgContradictionsResponse> {
  return kgGet<KgContradictionsResponse>("/api/kg/contradictions", { limit });
}

/**
 * Full-text search across KG fact text + relationship labels (Phase 86, KG-08).
 *
 * Bearer-authed GET to `/api/kg/search` via kgGet — throws AstridrApiError on
 * non-2xx. The consumer (KnowledgeGraph.tsx) is responsible for gating 404/501
 * to the "not deployed" informational copy (D-01 graceful-degrade).
 *
 * See Phase 86 header comment for cross-repo SEED requirements (subjectName,
 * GET vs POST, wire shape ownership).
 */
export function fetchSearch(params: KgSearchParams): Promise<KgSearchResponse> {
  return kgGet<KgSearchResponse>("/api/kg/search", {
    query: params.query,
    entity_type: params.entity_type,
    agent_id: params.agent_id,
    limit: params.limit,
  });
}
