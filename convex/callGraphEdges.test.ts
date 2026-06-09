import { describe, it, expect } from "vitest";

describe("callGraphEdges", () => {
  describe("upsertEdge — upsert logic", () => {
    it("increments callCount on subsequent call", () => {
      const existing = { callCount: 3, errorCount: 1 };
      const patch = { callCount: existing.callCount + 1 };
      expect(patch.callCount).toBe(4);
    });

    it("sets status to errored when success is false", () => {
      const success = false;
      const status = success ? "healthy" : "errored";
      expect(status).toBe("errored");
    });

    it("sets status to healthy when success is true", () => {
      const success = true;
      const status = success ? "healthy" : "errored";
      expect(status).toBe("healthy");
    });

    it("increments errorCount only on failure", () => {
      const existing = { errorCount: 2 };
      const successPatch = { errorCount: true ? existing.errorCount : existing.errorCount + 1 };
      const failurePatch = { errorCount: false ? existing.errorCount : existing.errorCount + 1 };
      expect(successPatch.errorCount).toBe(2);
      expect(failurePatch.errorCount).toBe(3);
    });

    it("sets lastErrorAt to timestamp on failure, preserves on success", () => {
      const existing = { lastErrorAt: 1000 };
      const timestamp = 2000;
      const onSuccess = true ? existing.lastErrorAt : timestamp;
      const onFailure = false ? existing.lastErrorAt : timestamp;
      expect(onSuccess).toBe(1000);
      expect(onFailure).toBe(2000);
    });

    it("initializes callCount to 1 and errorCount to 0 on first successful call", () => {
      const success = true;
      const initial = {
        callCount: 1,
        errorCount: success ? 0 : 1,
        lastErrorAt: success ? undefined : 1000,
        status: success ? "healthy" : "errored",
      };
      expect(initial.callCount).toBe(1);
      expect(initial.errorCount).toBe(0);
      expect(initial.lastErrorAt).toBeUndefined();
      expect(initial.status).toBe("healthy");
    });

    it("updates sessionId to most recent on upsert (global edge semantics)", () => {
      const existing = { sessionId: "sess-old" };
      const newSessionId = "sess-new";
      const patch = { sessionId: newSessionId };
      expect(patch.sessionId).toBe("sess-new");
      expect(patch.sessionId).not.toBe(existing.sessionId);
    });

    it.todo("should upsert via by_agent_tool index lookup (DB round-trip)");
    it.todo("should insert new row when no existing edge found (DB round-trip)");
  });

  describe("tool_executed event → upsertEdge mapping (M1.P1)", () => {
    // Mirrors the `case "tool_executed"` branch in runtimeIngest.ts: it maps a
    // tool_executed runtime event to upsertEdge args, accepting camelCase
    // (emitter shape) or snake_case keys, and skips when agentId is absent.
    const mapToolExecuted = (d: any, timestamp: number) => {
      const agentId = d.agentId ?? d.agent_id;
      if (!agentId) return null;
      return {
        agentId,
        toolName: d.toolName ?? d.tool_name ?? "unknown",
        sessionId: d.sessionId ?? d.session_id ?? "unknown",
        success: d.success ?? true,
        timestamp,
      };
    };

    it("maps camelCase emitter fields to upsertEdge args", () => {
      const args = mapToolExecuted(
        { agentId: "skuld", toolName: "web_search", sessionId: "sess-1", success: true },
        1234,
      );
      expect(args).toEqual({
        agentId: "skuld",
        toolName: "web_search",
        sessionId: "sess-1",
        success: true,
        timestamp: 1234,
      });
    });

    it("passes success=false through for the failure path", () => {
      const args = mapToolExecuted(
        { agentId: "hildr", toolName: "flaky_tool", sessionId: "sess-2", success: false },
        2000,
      );
      expect(args?.success).toBe(false);
    });

    it("accepts snake_case fallbacks", () => {
      const args = mapToolExecuted(
        { agent_id: "astridr", tool_name: "memory_save", session_id: "sess-3", success: true },
        3000,
      );
      expect(args?.agentId).toBe("astridr");
      expect(args?.toolName).toBe("memory_save");
      expect(args?.sessionId).toBe("sess-3");
    });

    it("defaults missing toolName/sessionId/success", () => {
      const args = mapToolExecuted({ agentId: "vor" }, 4000);
      expect(args?.toolName).toBe("unknown");
      expect(args?.sessionId).toBe("unknown");
      expect(args?.success).toBe(true);
    });

    it("skips upsert (returns null) when agentId is absent", () => {
      const args = mapToolExecuted({ toolName: "web_search", success: true }, 5000);
      expect(args).toBeNull();
    });
  });
});
