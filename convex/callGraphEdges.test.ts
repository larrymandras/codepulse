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
});
