// Open Design daemon API client
// Modeled on astridrApi.ts pattern — see RESEARCH.md Pattern 4
//
// The daemon has no authentication by default — it is designed for local-only use.
// VITE_OPEN_DESIGN_URL defaults to http://localhost:17456 (daemon default port).

import type {
  Skill,
  DesignSystem,
  OdAgent,
  OdProject,
  OdTemplate,
  RunRequest,
  RunStatus,
  HealthResponse,
  ExportFormat,
} from "./openDesignTypes";

const OD_BASE = import.meta.env.VITE_OPEN_DESIGN_URL ?? "http://localhost:17456";

export class OpenDesignApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "OpenDesignApiError";
    this.status = status;
  }
}

async function odRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${OD_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new OpenDesignApiError(
      res.status,
      body.error ?? `Open Design API error: ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Catalog endpoints
// ---------------------------------------------------------------------------

export function fetchSkills(): Promise<Skill[]> {
  return odRequest<Skill[]>("/api/skills");
}

export function fetchDesignSystems(): Promise<DesignSystem[]> {
  return odRequest<DesignSystem[]>("/api/design-systems");
}

export function fetchAgents(): Promise<OdAgent[]> {
  return odRequest<OdAgent[]>("/api/agents");
}

// Health check with 3s timeout — T-01-04 mitigation (STRIDE)
export function checkHealth(): Promise<HealthResponse> {
  return odRequest<HealthResponse>("/api/health", {
    signal: AbortSignal.timeout(3000),
  });
}

// ---------------------------------------------------------------------------
// Project endpoints
// ---------------------------------------------------------------------------

export function createProject(body: {
  name: string;
  skill_id?: string;
  design_system_id?: string;
}): Promise<OdProject> {
  return odRequest<OdProject>("/api/projects", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listProjects(): Promise<OdProject[]> {
  return odRequest<OdProject[]>("/api/projects");
}

// ---------------------------------------------------------------------------
// Run / Generation endpoints
// ---------------------------------------------------------------------------

export function createRun(body: RunRequest): Promise<{ runId: string }> {
  return odRequest<{ runId: string }>("/api/runs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getRunStatus(runId: string): Promise<RunStatus> {
  return odRequest<RunStatus>(`/api/runs/${runId}`);
}

/**
 * Consume the SSE stream for a run.
 * Uses fetch + ReadableStream for better control than EventSource.
 * [VERIFIED: nexu-io/open-design runs.ts + RESEARCH.md Pattern 1]
 *
 * Returns a cleanup function that aborts the stream.
 */
export function streamRunEvents(
  runId: string,
  options: {
    onToken: (text: string) => void;
    onError: (err: { code: string; message: string }) => void;
    onDone: (data: { code: number; signal: string | null; status: string }) => void;
    signal?: AbortSignal;
  },
): () => void {
  const controller = new AbortController();
  // Allow external signal to abort as well
  if (options.signal) {
    options.signal.addEventListener("abort", () => controller.abort());
  }

  void fetch(`${OD_BASE}/api/runs/${runId}/events`, {
    signal: controller.signal,
    headers: { Accept: "text/event-stream" },
  }).then(async (res) => {
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentEvent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Parse SSE lines from buffer
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const rawData = line.slice(6);
          try {
            const data = JSON.parse(rawData);
            if (currentEvent === "agent") {
              // Agent output tokens
              const text = (data.text ?? data.content ?? "") as string;
              if (text) options.onToken(text);
            } else if (currentEvent === "error") {
              options.onError({
                code: String(data.code ?? "unknown"),
                message: String(data.message ?? "Unknown error"),
              });
            } else if (currentEvent === "end") {
              options.onDone({
                code: Number(data.code ?? 0),
                signal: (data.signal as string | null) ?? null,
                status: String(data.status ?? "ended"),
              });
              return;
            }
          } catch {
            // Malformed JSON — ignore line
          }
          currentEvent = "";
        }
      }
    }
  }).catch(() => {
    // Stream aborted or network error — ignore
  });

  return () => controller.abort();
}

// ---------------------------------------------------------------------------
// Artifact & Import endpoints
// ---------------------------------------------------------------------------

export function saveArtifact(body: {
  html: string;
  projectId: string;
}): Promise<void> {
  return odRequest<void>("/api/artifacts/save", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Export a project in the given format.
 * Returns a Blob for browser download.
 *
 * NOTE: Export endpoint path is ASSUMED per RESEARCH.md A2.
 * Verify on first use: curl http://localhost:17456/api/export/test?format=html
 * If 404, inspect daemon routes and update this path.
 */
export async function exportProject(
  projectId: string,
  format: ExportFormat,
): Promise<Blob> {
  const res = await fetch(
    `${OD_BASE}/api/export/${encodeURIComponent(projectId)}?format=${format}`,
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new OpenDesignApiError(
      res.status,
      (body as { error?: string }).error ?? `Export failed: ${res.status}`,
    );
  }
  return res.blob();
}

/**
 * Import a Claude Design ZIP file.
 * Uses FormData — no Content-Type header set (browser sets multipart boundary).
 * [VERIFIED: importAgentYaml pattern from astridrApi.ts]
 */
export async function importClaudeDesign(file: File): Promise<OdProject> {
  const formData = new FormData();
  formData.append("file", file);

  // Do NOT set Content-Type — browser must set multipart/form-data with boundary
  const res = await fetch(`${OD_BASE}/api/import/claude-design`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new OpenDesignApiError(
      res.status,
      (body as { error?: string }).error ?? `Import failed: ${res.status}`,
    );
  }
  return res.json() as Promise<OdProject>;
}

// ---------------------------------------------------------------------------
// Template endpoints
// ---------------------------------------------------------------------------

export function listTemplates(): Promise<OdTemplate[]> {
  return odRequest<OdTemplate[]>("/api/templates");
}
