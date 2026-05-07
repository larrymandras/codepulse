import { describe, it, vi, beforeEach } from "vitest";

describe("openDesignApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchSkills", () => {
    it.todo("calls GET /api/skills using VITE_OPEN_DESIGN_URL env var");
  });

  describe("checkHealth", () => {
    it.todo("calls GET /api/health with 3s timeout");
  });

  describe("createRun", () => {
    it.todo("POSTs to /api/runs with correct body shape");
  });

  describe("exportProject", () => {
    it.todo("returns blob from GET /api/export/:id?format=...");
  });

  describe("importClaudeDesign", () => {
    it.todo("uses FormData without explicit Content-Type header");
  });

  describe("error handling", () => {
    it.todo("throws OpenDesignApiError with status code on non-200 response");
  });
});
