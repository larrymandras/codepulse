// Types derived from RESEARCH.md "Open Design REST API Surface"
// [VERIFIED: nexu-io/open-design source — db.ts, runs.ts, design-systems.ts]

export interface Skill {
  id: string;
  name: string;
  description: string;
  mode: string;
  surface: string;
  designSystemRequired: boolean;
  examplePrompt: string;
}

export interface DesignSystem {
  id: string;
  title: string;
  category: string;
  summary: string;
  swatches?: string[];
  surface?: string;
}

export interface OdAgent {
  id: string;
  name: string;
  available: boolean;
}

export interface OdProject {
  id: string;
  name: string;
  skill_id: string | null;
  design_system_id: string | null;
  pending_prompt: string | null;
  metadata_json: string | null;
  created_at: number;
  updated_at: number;
}

export interface OdTemplate {
  id: string;
  name: string;
  description: string | null;
  source_project_id: string | null;
  files_json: string;
  created_at: number;
}

export interface RunRequest {
  agentId: string;
  message: string;
  conversationId?: string;
  projectId?: string;
  clientRequestId?: string;
}

export interface RunStatus {
  id: string;
  status: "running" | "succeeded" | "failed" | "canceled";
  projectId: string | null;
  conversationId: string | null;
  exitCode: number | null;
  signal: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RunEvent {
  event: "agent" | "error" | "end";
  data: Record<string, unknown>;
}

export interface HealthResponse {
  ok: boolean;
  version: string;
}

export type ExportFormat = "html" | "pdf" | "pptx" | "zip" | "md";
