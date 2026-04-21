const ASTRIDR_API_BASE = import.meta.env.VITE_ASTRIDR_API_URL ?? "";

export interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  score: number;
}

export interface CatalogEntryDetail extends CatalogEntry {
  body: string;
  source: string;
  source_path: string;
}

export interface CreateAgentRequest {
  config: Record<string, unknown>;
  ephemeral: boolean;
  ttl_seconds?: number;
  soul_variant_content?: string;
}

export interface CreateAgentResponse {
  id: string;
  status: string;
  message: string;
}

export async function searchCatalog(params: {
  q?: string;
  tier?: string;
  limit?: number;
}): Promise<CatalogEntry[]> {
  const url = new URL(`${ASTRIDR_API_BASE}/api/catalog`);
  if (params.q) url.searchParams.set("q", params.q);
  if (params.tier) url.searchParams.set("tier", params.tier);
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Catalog search failed: ${res.status}`);
  return res.json();
}

export async function getCatalogEntry(
  id: string,
): Promise<CatalogEntryDetail> {
  const res = await fetch(
    `${ASTRIDR_API_BASE}/api/catalog/${encodeURIComponent(id)}`,
  );
  if (!res.ok) throw new Error(`Catalog entry not found: ${res.status}`);
  return res.json();
}

export async function createAgent(
  req: CreateAgentRequest,
): Promise<CreateAgentResponse> {
  const res = await fetch(`${ASTRIDR_API_BASE}/api/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Agent creation failed: ${res.status}`);
  }
  return res.json();
}

export async function validateAgent(
  config: Record<string, unknown>,
): Promise<{ valid: boolean; errors?: string[] }> {
  const res = await fetch(`${ASTRIDR_API_BASE}/api/agents/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config }),
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// Phase 76: Roster & Agent Detail types and endpoints
// ---------------------------------------------------------------------------

export interface AgentListItem {
  id: string;
  name: string;
  description?: string;
  tier: "command" | "domain" | "shared";
  active: boolean;
  budget_fraction: number;
  profiles?: string[];
  model?: string;
}

export interface AgentDetail extends AgentListItem {
  tools_enabled: string[];
  max_rounds: number;
  channels: string[];
  peer_comm_allowed?: string[];
  autonomy_level?: string;
}

export class AstridrApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AstridrApiError";
    this.status = status;
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ASTRIDR_API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new AstridrApiError(res.status, body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function fetchAgents(): Promise<AgentListItem[]> {
  return apiRequest<AgentListItem[]>("/api/agents");
}

export async function fetchAgentDetail(id: string): Promise<AgentDetail> {
  return apiRequest<AgentDetail>(`/api/agents/${id}`);
}

export async function updateAgent(
  id: string,
  config: Record<string, unknown>,
): Promise<{ id: string; status: string }> {
  return apiRequest<{ id: string; status: string }>(`/api/agents/${id}`, {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

export async function deleteAgent(
  id: string,
): Promise<{ id: string; status: string }> {
  return apiRequest<{ id: string; status: string }>(`/api/agents/${id}`, {
    method: "DELETE",
  });
}

export async function approveAgent(id: string): Promise<void> {
  await apiRequest<unknown>(`/api/approvals/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ decided_by: "codepulse" }),
  });
}

export async function rejectAgent(id: string): Promise<void> {
  await apiRequest<unknown>(`/api/approvals/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ decided_by: "codepulse" }),
  });
}

// ---------------------------------------------------------------------------
// Phase 78: War Room Launch
// ---------------------------------------------------------------------------

export interface CreateWarRoomRequest {
  participants: string[];
  topic?: string;
  teamPresetId?: string;
}

export interface CreateWarRoomResponse {
  room_name: string;
  participants: string[];
  topic?: string;
}

export async function createWarRoom(
  req: CreateWarRoomRequest,
): Promise<CreateWarRoomResponse> {
  return apiRequest<CreateWarRoomResponse>("/api/war-room", {
    method: "POST",
    body: JSON.stringify(req),
  });
}
