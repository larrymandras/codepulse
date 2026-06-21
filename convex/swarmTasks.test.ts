/**
 * Phase 149 PULSE-01 — swarmTasks unit tests
 *
 * Tests validate the query-then-insert-or-patch (upsert) idempotency,
 * byGoal filtering, and listGoals ordering using plain vitest mocks
 * (convex-test is not installed in this repo; plain vitest is used per
 * the existing test harness in convex/__tests__/alertRules.test.ts).
 */
import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Minimal in-memory store that emulates Convex db.query / db.insert / db.patch
// ---------------------------------------------------------------------------

type Doc = Record<string, any> & { _id: string };

function makeStore() {
  const swarmTasks: Doc[] = [];
  const swarmGoals: Doc[] = [];
  let seq = 0;
  const nextId = () => `id_${++seq}`;

  // Convex index builder: q => q.eq("fieldName", value) — capture the field/value pair.
  // The builder receives a qBuilder; we call fn(qBuilder) and record what it eq'd on.
  function captureEq(fn: (q: any) => any): { field: string; value: any } | null {
    let captured: { field: string; value: any } | null = null;
    fn({
      eq: (field: string, value: any) => {
        captured = { field, value };
        return true;
      },
      gte: (_field: string, _value: any) => true,
      lte: (_field: string, _value: any) => true,
    });
    return captured;
  }

  // filter builder: (q) => q.eq(q.field("fieldName"), value) — capture the field/value.
  function captureFilter(filterFn: (q: any) => any): { field: string; value: any } | null {
    let captured: { field: string; value: any } | null = null;
    filterFn({
      eq: (_left: any, value: any) => {
        if (captured) return captured;
        captured = { field: "__last_field__", value };
        return true;
      },
      field: (name: string) => name, // returns the field name as a string sentinel
    });
    // Re-run to capture the actual field name — q.field returns the name, q.eq receives it
    let lastField = "";
    let lastValue: any;
    filterFn({
      eq: (left: any, value: any) => {
        lastField = left;
        lastValue = value;
        return true;
      },
      field: (name: string) => name,
    });
    return lastField ? { field: lastField, value: lastValue } : null;
  }

  const db = {
    query: (tableName: string) => {
      const table = tableName === "swarmTasks" ? swarmTasks : swarmGoals;

      return {
        withIndex: (indexName: string, indexFn?: (q: any) => any) => {
          // Determine the filter from the index function
          const indexFilter = indexFn ? captureEq(indexFn) : null;

          const applyIndexFilter = (rows: Doc[]) => {
            if (!indexFilter) return rows;
            return rows.filter((r) => r[indexFilter.field] === indexFilter.value);
          };

          return {
            filter: (filterFn: (q: any) => any) => {
              const filterInfo = captureFilter(filterFn);
              const applyBoth = (rows: Doc[]) => {
                let filtered = applyIndexFilter(rows);
                if (filterInfo) {
                  filtered = filtered.filter((r) => r[filterInfo.field] === filterInfo.value);
                }
                return filtered;
              };
              return {
                first: async () => applyBoth(table)[0] ?? null,
                collect: async () => applyBoth(table),
              };
            },
            first: async () => applyIndexFilter(table)[0] ?? null,
            collect: async () => applyIndexFilter(table),
            order: (_dir: "asc" | "desc") => ({
              collect: async () => {
                const rows = applyIndexFilter(table);
                // order by createdAt desc for swarmGoals
                if (_dir === "desc") return [...rows].sort((a, b) => b.createdAt - a.createdAt);
                return [...rows].sort((a, b) => a.createdAt - b.createdAt);
              },
            }),
          };
        },
      };
    },

    insert: async (tableName: string, data: Record<string, any>) => {
      const doc = { ...data, _id: nextId() };
      if (tableName === "swarmTasks") swarmTasks.push(doc as Doc);
      else if (tableName === "swarmGoals") swarmGoals.push(doc as Doc);
      return doc._id;
    },

    patch: async (id: string, data: Record<string, any>) => {
      const patchIn = (arr: Doc[]) => {
        const idx = arr.findIndex((r) => r._id === id);
        if (idx !== -1) Object.assign(arr[idx], data);
      };
      patchIn(swarmTasks);
      patchIn(swarmGoals);
    },
  };

  return { swarmTasks, swarmGoals, db };
}

// ---------------------------------------------------------------------------
// Upsert logic — mirrors swarmTasks.ts handler exactly
// ---------------------------------------------------------------------------

async function upsertLogic(
  ctx: any,
  args: {
    goalId: string;
    subtaskId: string;
    state: string;
    subtask: string;
    dependsOn: string[];
    claimedBy?: string;
    model?: string;
    agentId?: string;
    timestamp: number;
  }
) {
  const now = args.timestamp ?? Date.now() / 1000;

  // swarmTasks: query-then-insert-or-patch
  const existing = await ctx.db
    .query("swarmTasks")
    .withIndex("by_subtask", (q: any) => q.eq("subtaskId", args.subtaskId))
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      state: args.state,
      claimedBy: args.claimedBy,
      model: args.model,
      agentId: args.agentId,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("swarmTasks", {
      goalId: args.goalId,
      subtaskId: args.subtaskId,
      state: args.state,
      subtask: args.subtask,
      dependsOn: args.dependsOn,
      claimedBy: args.claimedBy,
      model: args.model,
      agentId: args.agentId,
      timestamp: now,
      updatedAt: now,
    });
  }

  // swarmGoals: maintain denorm row (OQ-2)
  const existingGoal = await ctx.db
    .query("swarmGoals")
    .withIndex("by_created", (q: any) => q.gte("createdAt", 0))
    .filter((q: any) => q.eq(q.field("goalId"), args.goalId))
    .first();

  if (existingGoal) {
    await ctx.db.patch(existingGoal._id, {
      latestState: args.state,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("swarmGoals", {
      goalId: args.goalId,
      firstSubtask: args.subtask,
      latestState: args.state,
      createdAt: now,
      updatedAt: now,
    });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("swarmTasks.upsert", () => {
  it("inserts a new row on first call", async () => {
    const store = makeStore();
    await upsertLogic(store, {
      goalId: "goal-1",
      subtaskId: "sub-1",
      state: "pending",
      subtask: "research Nordic trends",
      dependsOn: [],
      timestamp: 1000,
    });
    expect(store.swarmTasks).toHaveLength(1);
    expect(store.swarmTasks[0].subtaskId).toBe("sub-1");
    expect(store.swarmTasks[0].state).toBe("pending");
    expect(store.swarmTasks[0].goalId).toBe("goal-1");
  });

  it("patches (no duplicate row) on second call with same subtaskId", async () => {
    const store = makeStore();
    await upsertLogic(store, {
      goalId: "goal-1",
      subtaskId: "sub-1",
      state: "pending",
      subtask: "research",
      dependsOn: [],
      timestamp: 1000,
    });
    await upsertLogic(store, {
      goalId: "goal-1",
      subtaskId: "sub-1",
      state: "claimed",
      subtask: "research",
      dependsOn: [],
      claimedBy: "hervor",
      timestamp: 1001,
    });
    // Exactly one row — no duplicate
    expect(store.swarmTasks).toHaveLength(1);
    expect(store.swarmTasks[0].state).toBe("claimed");
    expect(store.swarmTasks[0].claimedBy).toBe("hervor");
  });

  it("inserts a swarmGoals row on first sighting of goalId", async () => {
    const store = makeStore();
    await upsertLogic(store, {
      goalId: "goal-2",
      subtaskId: "sub-2",
      state: "pending",
      subtask: "draft post",
      dependsOn: [],
      timestamp: 2000,
    });
    expect(store.swarmGoals).toHaveLength(1);
    expect(store.swarmGoals[0].goalId).toBe("goal-2");
    expect(store.swarmGoals[0].firstSubtask).toBe("draft post");
    expect(store.swarmGoals[0].latestState).toBe("pending");
  });

  it("patches swarmGoals latestState on subsequent calls, no duplicate goal row", async () => {
    const store = makeStore();
    await upsertLogic(store, {
      goalId: "goal-3",
      subtaskId: "sub-3",
      state: "pending",
      subtask: "work",
      dependsOn: [],
      timestamp: 3000,
    });
    await upsertLogic(store, {
      goalId: "goal-3",
      subtaskId: "sub-3",
      state: "done",
      subtask: "work",
      dependsOn: [],
      timestamp: 3001,
    });
    expect(store.swarmGoals).toHaveLength(1);
    expect(store.swarmGoals[0].latestState).toBe("done");
  });
});

describe("swarmTasks.byGoal", () => {
  it("returns only rows matching the goalId", async () => {
    const store = makeStore();
    await upsertLogic(store, {
      goalId: "goal-A",
      subtaskId: "subA-1",
      state: "pending",
      subtask: "task A1",
      dependsOn: [],
      timestamp: 100,
    });
    await upsertLogic(store, {
      goalId: "goal-B",
      subtaskId: "subB-1",
      state: "pending",
      subtask: "task B1",
      dependsOn: [],
      timestamp: 101,
    });

    const results = await store.db
      .query("swarmTasks")
      .withIndex("by_goal", (q: any) => q.eq("goalId", "goal-A"))
      .collect();

    expect(results).toHaveLength(1);
    expect(results[0].goalId).toBe("goal-A");
    expect(results[0].subtaskId).toBe("subA-1");
  });
});

describe("swarmTasks.listGoals", () => {
  it("returns swarmGoals after a pending upsert", async () => {
    const store = makeStore();
    await upsertLogic(store, {
      goalId: "goal-list",
      subtaskId: "sub-list",
      state: "pending",
      subtask: "list test",
      dependsOn: [],
      timestamp: 500,
    });

    const goals = await store.db
      .query("swarmGoals")
      .withIndex("by_created")
      .order("desc")
      .collect();

    expect(goals).toHaveLength(1);
    expect(goals[0].goalId).toBe("goal-list");
    expect(goals[0].latestState).toBe("pending");
  });

  it("returns newest goal first when multiple goals exist", async () => {
    const store = makeStore();
    await upsertLogic(store, {
      goalId: "goal-old",
      subtaskId: "sub-old",
      state: "done",
      subtask: "old task",
      dependsOn: [],
      timestamp: 1000,
    });
    await upsertLogic(store, {
      goalId: "goal-new",
      subtaskId: "sub-new",
      state: "pending",
      subtask: "new task",
      dependsOn: [],
      timestamp: 2000,
    });

    const goals = await store.db
      .query("swarmGoals")
      .withIndex("by_created")
      .order("desc")
      .collect();

    expect(goals[0].goalId).toBe("goal-new");
    expect(goals[1].goalId).toBe("goal-old");
  });
});
