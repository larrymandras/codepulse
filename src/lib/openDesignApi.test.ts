import { describe, it, vi, beforeEach, expect } from "vitest";
import {
  fetchSkills,
  checkHealth,
  createRun,
  exportProject,
  importClaudeDesign,
  OpenDesignApiError,
} from "./openDesignApi";

// Mock global fetch for all tests in this suite
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Helper to build a mock Response
function mockResponse(
  body: unknown,
  options: { status?: number; ok?: boolean; blob?: Blob } = {},
): Response {
  const status = options.status ?? 200;
  const ok = options.ok ?? (status >= 200 && status < 300);
  return {
    ok,
    status,
    json: async () => body,
    blob: async () => options.blob ?? new Blob([JSON.stringify(body)]),
    statusText: ok ? "OK" : "Error",
  } as unknown as Response;
}

describe("openDesignApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockFetch.mockReset();
  });

  describe("fetchSkills", () => {
    it("calls GET /od-api/skills and unwraps the skills array", async () => {
      const skills = [
        { id: "landing", name: "Landing Page", description: "Build a landing page", mode: "web", surface: "web", designSystemRequired: false, examplePrompt: "" },
      ];
      mockFetch.mockResolvedValueOnce(mockResponse({ skills }));

      const result = await fetchSkills();

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/od-api/skills");
      expect(init?.method).toBeUndefined(); // GET is implicit
      expect(result).toEqual(skills);
    });
  });

  describe("checkHealth", () => {
    it("calls GET /od-api/health with 3s timeout", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ status: "ok" }));

      const result = await checkHealth();

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/od-api/health");
      expect(init?.signal).toBeDefined();
      expect(result).toEqual({ status: "ok" });
    });
  });

  describe("createRun", () => {
    it("POSTs to /od-api/runs with correct body shape", async () => {
      const runRequest = {
        agentId: "claude-code",
        message: "Build me a landing page",
        projectId: "proj-123",
      };
      mockFetch.mockResolvedValueOnce(mockResponse({ runId: "run-abc" }));

      const result = await createRun(runRequest);

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/od-api/runs");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(init?.body as string)).toEqual(runRequest);
      expect(result).toEqual({ runId: "run-abc" });
    });
  });

  describe("exportProject", () => {
    it("returns blob from GET /api/export/:id?format=...", async () => {
      const blob = new Blob(["<html>test</html>"], { type: "text/html" });
      mockFetch.mockResolvedValueOnce(mockResponse(null, { blob }));

      const result = await exportProject("proj-123", "html");

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toContain("/api/export/proj-123");
      expect(url).toContain("format=html");
      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe("importClaudeDesign", () => {
    it("uses FormData without explicit Content-Type header", async () => {
      const project = { id: "proj-new", name: "Imported", skill_id: null, design_system_id: null, pending_prompt: null, metadata_json: null, created_at: 1234, updated_at: 1234 };
      mockFetch.mockResolvedValueOnce(mockResponse(project));

      const file = new File(["zip content"], "export.zip", { type: "application/zip" });
      const result = await importClaudeDesign(file);

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/api/import/claude-design");
      expect(init?.method).toBe("POST");
      // Body must be FormData — not a JSON string
      expect(init?.body).toBeInstanceOf(FormData);
      // Content-Type must NOT be set manually (browser sets multipart boundary)
      const headers = init?.headers as Record<string, string> | undefined;
      expect(headers?.["Content-Type"]).toBeUndefined();
      expect(result).toEqual(project);
    });
  });

  describe("error handling", () => {
    it("throws OpenDesignApiError with status code on non-200 response", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ error: "Not found" }, { status: 404, ok: false }),
      );

      await expect(fetchSkills()).rejects.toThrow(OpenDesignApiError);

      try {
        mockFetch.mockResolvedValueOnce(
          mockResponse({ error: "Not found" }, { status: 404, ok: false }),
        );
        await fetchSkills();
      } catch (err) {
        expect(err).toBeInstanceOf(OpenDesignApiError);
        expect((err as OpenDesignApiError).status).toBe(404);
        expect((err as OpenDesignApiError).message).toBe("Not found");
      }
    });
  });
});
