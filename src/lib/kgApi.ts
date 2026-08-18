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
  entity: {
    id: string;
    name: string;
    /**
     * The focused entity's real type (187 post-verify fix, GLXY-01). Optional
     * because older astridr deployments predate this field — `undefined` and
     * `null` both mean "unknown", never "person". Previously ABSENT entirely,
     * which forced `kg-graph.ts` `normalizeEntity` to hardcode
     * `entityType: "person"` for every ego-lens focus node — a wrong guess
     * that also used to collide visually, back when the lit branch itself
     * hardcoded `person`'s own fill color (`#10b981`) for every lit node
     * (fixed in Phase 190/GLXY-03, which made the lit branch pass the node's
     * real color through instead). This field is why `normalizeEntity` no
     * longer has to guess "person" at all.
     */
    entityType?: string | null;
  } | null;
  /**
   * 190-08/D-11/GLXY-04: present only on a multi-id `entity_ids=` request —
   * every resolved entity, in requested order (`KGReadService.entities()`,
   * astridr `kg_read_api.py`). Optional/additive so a single-`entity_id` or
   * `name` response (which never carries this key) still type-checks; the
   * multi normalizer (`kg-graph.ts` `normalizeEntities`) degrades to the
   * single-entity behaviour when this is absent.
   */
  entities?: KgEntity[];
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
  /**
   * Exactly one of `name` / `entityId` / `entityIds` reaches the wire —
   * mirrors the astridr `/api/kg/entity` route contract (187-05, extended by
   * 190-07/D-11 for `entityIds`). Precedence is `entityIds` > `entityId` >
   * `name`: when more than one is supplied here, the lower-precedence ones
   * are dropped before the request is sent (see `fetchEntity`) so the astridr
   * route's three-way mutual-exclusion check never sees more than one.
   */
  name?: string;
  /**
   * Pins the lookup to an exact entity UUID, bypassing astridr's
   * name-similarity resolver — required when an id is already known (e.g.
   * the D-09 answer-sync ego-lens fallback), since entity names are not
   * unique (187-05: two "astridr" rows of different types can coexist) and
   * a name-only fetch can silently resolve to the wrong duplicate.
   */
  entityId?: string;
  /**
   * 190-08/D-11/GLXY-04: pins the lookup to N entity UUIDs in one round-trip
   * (a turn resolving N>1 sources, e.g. the D-09 answer-sync fallback with
   * more than one resolved source). Takes precedence over `entityId`/`name`
   * when non-empty. An empty array is treated as absent (no `entity_ids`
   * param reaches the wire) so the caller can pass `[]` as a no-op without a
   * separate guard. The astridr route bounds this at `_MAX_ENTITY_IDS` (8,
   * `kg_read_api.py`) and 422s above it — the caller (`KnowledgeGraph.tsx`
   * `MAX_LENS_SOURCE_IDS`) must truncate before calling `fetchEntity`, since
   * a 422 here would error the whole lens rather than degrade gracefully.
   */
  entityIds?: string[];
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
  // 190-08/D-11: entityIds > entityId > name — never send more than one (the
  // astridr route 422s on any combination of >1, 190-07's three-way check).
  // kgGet already drops undefined/null/"" params, so an absent/empty
  // entityIds falls through to the entityId/name modes unchanged — this is
  // the D-13 control: a single-source call (no entityIds) sends entity_id
  // and no entity_ids, byte-identical to pre-190-08 behavior.
  const hasIds = !!params.entityIds && params.entityIds.length > 0;
  return kgGet<KgEntityResponse>("/api/kg/entity", {
    name: hasIds || params.entityId ? undefined : params.name,
    entity_id: hasIds ? undefined : params.entityId,
    entity_ids: hasIds ? params.entityIds!.join(",") : undefined,
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
