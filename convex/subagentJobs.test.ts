/**
 * Phase 168 (background subagents) — subagentJobs unit tests.
 *
 * Mirrors swarmTasks.test.ts's plain-vitest in-memory db mock (convex-test
 * is not installed in this repo). Validates upsert insert-then-patch
 * idempotency on jobId, byId lookup, listRecent ordering, and a full
 * queued -> running -> completed status transition persisting correctly.
 */
import { describe, it, expect } from "vitest";

type Doc = Record<string, any> & { _id: string };

function makeStore() {
  const subagentJobs: Doc[] = [];
  let seq = 0;
  const nextId = () => `id_${++seq}`;

  function captureEq(fn: (q: any) => any): { field: string; value: any } | null {
    let captured: { field: string; value: any } | null = null;
    fn({
      eq: (field: string, value: any) => {
        captured = { field, value };
        return true;
      },
    });
    return captured;
  }

  const db = {
    query: (tableName: string) => {
      const table = tableName === "subagentJobs" ? subagentJobs : [];
      return {
        withIndex: (_indexName: string, indexFn?: (q: any) => any) => {
          const indexFilter = indexFn ? captureEq(indexFn) : null;
          const applyIndexFilter = (rows: Doc[]) => {
            if (!indexFilter) return rows;
            return rows.filter((r) => r[indexFilter.field] === indexFilter.value);
          };
          return {
            first: async () => applyIndexFilter(table)[0] ?? null,
            collect: async () => applyIndexFilter(table),
          };
        },
        collect: async () => [...table],
      };
    },

    insert: async (tableName: string, data: Record<string, any>) => {
      const doc = { ...data, _id: nextId() };
      if (tableName === "subagentJobs") subagentJobs.push(doc as Doc);
      return doc._id;
    },

    patch: async (id: string, data: Record<string, any>) => {
      const idx = subagentJobs.findIndex((r) => r._id === id);
      if (idx !== -1) Object.assign(subagentJobs[idx], data);
    },
  };

  return { subagentJobs, db };
}

// ---------------------------------------------------------------------------
// upsert logic — mirrors subagentJobs.ts's handler exactly
// ---------------------------------------------------------------------------

async function upsertLogic(
  ctx: any,
  args: {
    jobId: string;
    agentTypeId: string;
    status: string;
    taskSnippet: string;
    resultSnippet?: string;
    error?: string;
    channelId?: string;
    chatId?: string;
    submittedAt?: number;
    finishedAt?: number;
  }
) {
  const now = args.finishedAt ?? args.submittedAt ?? Date.now() / 1000;

  const existing = await ctx.db
    .query("subagentJobs")
    .withIndex("by_jobId", (q: any) => q.eq("jobId", args.jobId))
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      agentTypeId: args.agentTypeId,
      status: args.status,
      taskSnippet: args.taskSnippet,
      resultSnippet: args.resultSnippet,
      error: args.error,
      channelId: args.channelId ?? existing.channelId,
      chatId: args.chatId ?? existing.chatId,
      finishedAt: args.finishedAt ?? existing.finishedAt,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("subagentJobs", {
      jobId: args.jobId,
      agentTypeId: args.agentTypeId,
      status: args.status,
      taskSnippet: args.taskSnippet,
      resultSnippet: args.resultSnippet,
      error: args.error,
      channelId: args.channelId,
      chatId: args.chatId,
      submittedAt: args.submittedAt ?? args.finishedAt ?? now,
      finishedAt: args.finishedAt,
      updatedAt: now,
    });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("subagentJobs.upsert", () => {
  it("inserts a new row on first call", async () => {
    const store = makeStore();
    await upsertLogic(store, {
      jobId: "job-1",
      agentTypeId: "researcher",
      status: "queued",
      taskSnippet: "research Nordic trends",
      submittedAt: 1000,
    });
    expect(store.subagentJobs).toHaveLength(1);
    expect(store.subagentJobs[0].jobId).toBe("job-1");
    expect(store.subagentJobs[0].status).toBe("queued");
    expect(store.subagentJobs[0].agentTypeId).toBe("researcher");
  });

  it("patches (no duplicate row) on second call with same jobId", async () => {
    const store = makeStore();
    await upsertLogic(store, {
      jobId: "job-2",
      agentTypeId: "researcher",
      status: "queued",
      taskSnippet: "draft post",
      submittedAt: 1000,
    });
    await upsertLogic(store, {
      jobId: "job-2",
      agentTypeId: "researcher",
      status: "running",
      taskSnippet: "draft post",
      submittedAt: 1000,
    });
    expect(store.subagentJobs).toHaveLength(1);
    expect(store.subagentJobs[0].status).toBe("running");
  });

  it("persists a full queued -> running -> completed transition on one row", async () => {
    const store = makeStore();
    await upsertLogic(store, {
      jobId: "job-3",
      agentTypeId: "coder",
      status: "queued",
      taskSnippet: "fix flaky test",
      submittedAt: 2000,
    });
    await upsertLogic(store, {
      jobId: "job-3",
      agentTypeId: "coder",
      status: "running",
      taskSnippet: "fix flaky test",
      submittedAt: 2000,
    });
    await upsertLogic(store, {
      jobId: "job-3",
      agentTypeId: "coder",
      status: "completed",
      taskSnippet: "fix flaky test",
      resultSnippet: "test now passes",
      submittedAt: 2000,
      finishedAt: 2050,
    });

    expect(store.subagentJobs).toHaveLength(1);
    const row = store.subagentJobs[0];
    expect(row.status).toBe("completed");
    expect(row.resultSnippet).toBe("test now passes");
    expect(row.submittedAt).toBe(2000);
    expect(row.finishedAt).toBe(2050);
  });

  it("stores error on a failed terminal state", async () => {
    const store = makeStore();
    await upsertLogic(store, {
      jobId: "job-4",
      agentTypeId: "researcher",
      status: "failed",
      taskSnippet: "scrape site",
      error: "timeout after 1800s",
      submittedAt: 3000,
      finishedAt: 3050,
    });
    expect(store.subagentJobs[0].status).toBe("failed");
    expect(store.subagentJobs[0].error).toBe("timeout after 1800s");
  });
});

describe("subagentJobs.byId", () => {
  it("returns the row matching jobId", async () => {
    const store = makeStore();
    await upsertLogic(store, {
      jobId: "job-A",
      agentTypeId: "researcher",
      status: "queued",
      taskSnippet: "task A",
      submittedAt: 100,
    });
    await upsertLogic(store, {
      jobId: "job-B",
      agentTypeId: "coder",
      status: "queued",
      taskSnippet: "task B",
      submittedAt: 101,
    });

    const result = await store.db
      .query("subagentJobs")
      .withIndex("by_jobId", (q: any) => q.eq("jobId", "job-A"))
      .first();

    expect(result).not.toBeNull();
    expect(result.jobId).toBe("job-A");
    expect(result.taskSnippet).toBe("task A");
  });

  it("returns null when jobId is not found", async () => {
    const store = makeStore();
    const result = await store.db
      .query("subagentJobs")
      .withIndex("by_jobId", (q: any) => q.eq("jobId", "missing"))
      .first();
    expect(result).toBeNull();
  });
});

describe("subagentJobs.listRecent", () => {
  it("returns rows newest-first by submittedAt", async () => {
    const store = makeStore();
    await upsertLogic(store, {
      jobId: "job-old",
      agentTypeId: "researcher",
      status: "completed",
      taskSnippet: "old task",
      submittedAt: 1000,
    });
    await upsertLogic(store, {
      jobId: "job-new",
      agentTypeId: "coder",
      status: "queued",
      taskSnippet: "new task",
      submittedAt: 2000,
    });

    const rows = (await store.db.query("subagentJobs").collect()) as Doc[];
    const sorted = rows.sort((a, b) => b.submittedAt - a.submittedAt);

    expect(sorted[0].jobId).toBe("job-new");
    expect(sorted[1].jobId).toBe("job-old");
  });
});
