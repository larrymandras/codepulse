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
