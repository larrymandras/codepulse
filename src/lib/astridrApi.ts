const ASTRIDR_API_BASE = import.meta.env.VITE_ASTRIDR_API_URL ?? "";
const ASTRIDR_API_KEY = import.meta.env.VITE_ASTRIDR_API_KEY ?? "";

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
  const res = await fetch(url.toString(), {
    headers: ASTRIDR_API_KEY ? { Authorization: `Bearer ${ASTRIDR_API_KEY}` } : {},
  });
  if (!res.ok) throw new Error(`Catalog search failed: ${res.status}`);
  return res.json();
}

export async function getCatalogEntry(
  id: string,
): Promise<CatalogEntryDetail> {
  const res = await fetch(
    `${ASTRIDR_API_BASE}/api/catalog/${encodeURIComponent(id)}`,
    { headers: ASTRIDR_API_KEY ? { Authorization: `Bearer ${ASTRIDR_API_KEY}` } : {} },
  );
  if (!res.ok) throw new Error(`Catalog entry not found: ${res.status}`);
  return res.json();
}

export async function createAgent(
  req: CreateAgentRequest,
): Promise<CreateAgentResponse> {
  const res = await fetch(`${ASTRIDR_API_BASE}/api/agents`, {
    method: "POST",
    headers: authHeaders(),
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
  return apiRequest<{ valid: boolean; errors?: string[] }>(
    "/api/agents/validate",
    {
      method: "POST",
      body: JSON.stringify({ config }),
    },
  );
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

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (ASTRIDR_API_KEY) h["Authorization"] = `Bearer ${ASTRIDR_API_KEY}`;
  return h;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ASTRIDR_API_BASE}${path}`, {
    headers: authHeaders(),
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new AstridrApiError(res.status, body.detail ?? body.error ?? res.statusText);
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
// Phase 79: Clone & Import
// ---------------------------------------------------------------------------

export interface CloneAgentResponse {
  id: string;
  source_id: string;
  status: string;
}

export async function cloneAgent(
  agentId: string,
): Promise<CloneAgentResponse> {
  return apiRequest<CloneAgentResponse>(`/api/agents/${agentId}/clone`, {
    method: "POST",
  });
}

export interface ImportAgentResponse {
  id: string;
  status: string;
}

export async function importAgentYaml(
  file: File,
): Promise<ImportAgentResponse> {
  const formData = new FormData();
  formData.append("file", file);

  // Use raw fetch -- FormData needs multipart/form-data, not application/json
  const headers: Record<string, string> = {};
  if (ASTRIDR_API_KEY) headers["Authorization"] = `Bearer ${ASTRIDR_API_KEY}`;

  const res = await fetch(`${ASTRIDR_API_BASE}/api/agents/import`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    // Structured validation errors from Pydantic
    if (res.status === 422 && body.detail?.errors) {
      const err = new AstridrApiError(422, "YAML validation failed");
      (err as any).validationErrors = body.detail.errors as string[];
      throw err;
    }
    throw new AstridrApiError(
      res.status,
      typeof body.detail === "string" ? body.detail : res.statusText,
    );
  }
  return res.json();
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

// ---------------------------------------------------------------------------
// Meeting Bot: Send / Leave / Status
// ---------------------------------------------------------------------------

export interface SendBotRequest {
  meeting_url: string;
  agent_id: string;
}

export interface SendBotResponse {
  status: string;
  data: { bot_id: string; bot_name: string; meeting_url: string };
}

export async function sendMeetingBot(
  req: SendBotRequest,
): Promise<SendBotResponse> {
  return apiRequest<SendBotResponse>("/api/meeting-bot/send", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function leaveMeetingBot(botId: string): Promise<void> {
  await apiRequest<unknown>("/api/meeting-bot/leave", {
    method: "POST",
    body: JSON.stringify({ bot_id: botId }),
  });
}

// ---------------------------------------------------------------------------
// Phase 80: Config Versioning & Rollback
// ---------------------------------------------------------------------------

export interface RollbackRequest {
  config: Record<string, unknown>;
  target_version: number;
  author?: string;
}

export async function rollbackAgent(
  id: string,
  req: RollbackRequest,
): Promise<{ id: string; status: string; target_version: number }> {
  return apiRequest<{ id: string; status: string; target_version: number }>(
    `/api/agents/${id}/rollback`,
    {
      method: "POST",
      body: JSON.stringify(req),
    },
  );
}

// ---------------------------------------------------------------------------
// Phase 02: Email Template Manager
// ---------------------------------------------------------------------------

export interface EmailLayout {
  id: string;
  slug: string;
  name: string;
  description: string;
  html_header: string;
  html_footer: string;
  css: string;
  logo_storage_path: string;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LayoutCreate {
  name: string;
  slug: string;
  description: string;
  html_header: string;
  html_footer: string;
  css: string;
  logo_storage_path?: string;
}

export interface EmailTemplate {
  id: string;
  layout_id: string | null;
  slug: string;
  name: string;
  purpose: string;
  category: string;
  subject_template: string;
  html_body: string;
  text_body: string;
  variables: Record<string, import("./emailTemplateUtils").VariableDefinition>;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateCreate {
  name: string;
  slug: string;
  purpose: string;
  category: string;
  layout_id?: string | null;
  subject_template: string;
  html_body: string;
  text_body: string;
  variables: Record<string, import("./emailTemplateUtils").VariableDefinition>;
}

export interface AgentEmailDefaults {
  id: string;
  agent_id: string;
  default_layout_id: string | null;
  signature_name: string;
  signature_title: string;
  avatar_storage_path: string;
  created_at: string;
  updated_at: string;
}

export interface PreviewResponse {
  subject: string;
  html: string;
  text: string;
}

export interface EmailAssetItem {
  name: string;
  public_url: string;
  storage_path: string;
  size?: number;
  created_at?: string;
}

// Layouts
export const fetchLayouts = () =>
  apiRequest<EmailLayout[]>("/api/email-layouts?is_active=eq.true");

export const fetchLayout = (slug: string) =>
  apiRequest<EmailLayout>(`/api/email-layouts/${slug}`);

export const createLayout = (body: LayoutCreate) =>
  apiRequest<{ slug: string }>("/api/email-layouts", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateLayout = (slug: string, body: Partial<LayoutCreate>) =>
  apiRequest<{ slug: string }>(`/api/email-layouts/${slug}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const deleteLayout = (slug: string) =>
  apiRequest<{ slug: string; status: string }>(`/api/email-layouts/${slug}`, {
    method: "DELETE",
  });

// Templates
export const fetchTemplates = () =>
  apiRequest<EmailTemplate[]>("/api/email-templates?is_active=eq.true");

export const fetchTemplate = (slug: string) =>
  apiRequest<EmailTemplate>(`/api/email-templates/${slug}`);

export const createTemplate = (body: TemplateCreate) =>
  apiRequest<{ slug: string }>("/api/email-templates", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateTemplate = (slug: string, body: Partial<TemplateCreate>) =>
  apiRequest<{ slug: string }>(`/api/email-templates/${slug}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const deleteTemplate = (slug: string) =>
  apiRequest<{ slug: string; status: string }>(`/api/email-templates/${slug}`, {
    method: "DELETE",
  });

export const previewTemplate = (
  slug: string,
  body: {
    variables: Record<string, string>;
    agent_id?: string;
    channel?: "smtp" | "gmail";
  },
) =>
  apiRequest<PreviewResponse>(`/api/email-templates/${slug}/preview`, {
    method: "POST",
    body: JSON.stringify(body),
  });

// Agent email defaults
export const fetchAgentEmailDefaults = (agentId: string) =>
  apiRequest<AgentEmailDefaults>(`/api/agents/${agentId}/email-defaults`);

export const upsertAgentEmailDefaults = (
  agentId: string,
  body: {
    default_layout_id?: string | null;
    signature_name: string;
    signature_title: string;
    avatar_storage_path: string;
  },
) =>
  apiRequest<{ agent_id: string }>(`/api/agents/${agentId}/email-defaults`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

// Asset upload — uses FormData pattern, NOT apiRequest/authHeaders (per D-12, Pitfall 5)
export async function uploadEmailAsset(
  file: File,
  folder: "avatars" | "logos",
): Promise<{ storage_path: string; public_url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const headers: Record<string, string> = {};
  if (ASTRIDR_API_KEY) headers["Authorization"] = `Bearer ${ASTRIDR_API_KEY}`;
  // DO NOT set Content-Type — browser sets multipart/form-data boundary automatically
  const url = new URL(`${ASTRIDR_API_BASE}/api/email-assets/upload`);
  url.searchParams.set("folder", folder);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers,
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new AstridrApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json();
}

// Asset listing — list all assets from email-assets bucket
export const fetchEmailAssets = (folder?: "avatars" | "logos") => {
  const qs = folder ? `?folder=${encodeURIComponent(folder)}` : "";
  return apiRequest<EmailAssetItem[]>(`/api/email-assets${qs}`);
};

// Asset deletion
export const deleteEmailAsset = (storagePath: string) =>
  apiRequest<{ status: string }>(
    `/api/email-assets/${encodeURIComponent(storagePath)}`,
    { method: "DELETE" },
  );
