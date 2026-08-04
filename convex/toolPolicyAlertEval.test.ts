/**
 * Tests for convex/toolPolicyAlertEval.ts — Phase 105 (Tool & Trace
 * Observability), Plan 04, Task 1.
 *
 * Fake ctx generalizes the query/withIndex(eq/gte/gt/lte/lt)/collect/take
 * convention from convex/costBudgetEval.test.ts's `makeEvalCtx` (this repo
 * has no convex-test), adding a per-kind read trapdoor to exercise the
 * per-kind try/catch isolation without needing convex-test to fabricate a
 * real downstream failure.
 */
import { describe, test, expect } from "vitest";
import {
  ALERTING_POLICY_KINDS,
  POLICY_EVENT_READ_CAP,
  POLICY_ERROR_SNIPPET_LEN,
  policyAlertSeverity,
  buildToolPolicyAlertMessage,
  evaluateToolPolicyAlerts,
} from "./toolPolicyAlertEval";

type FakeDoc = Record<string, any>;

function makePolicyCtx(
  opts: {
    toolPolicyEvents?: FakeDoc[];
    alerts?: FakeDoc[];
    throwOnKind?: string;
  } = {}
) {
  const tables: Record<string, FakeDoc[]> = {
    toolPolicyEvents: [...(opts.toolPolicyEvents ?? [])],
    alerts: [...(opts.alerts ?? [])],
  };
  let nextId = 1;
  const schedulerCalls: Array<{ delay: number; fn: unknown; args: unknown }> = [];

  function query(table: string) {
    const rows = tables[table] ?? (tables[table] = []);
    const predicates: Array<(r: FakeDoc) => boolean> = [];
    let dir: "asc" | "desc" = "asc";

    const chain = {
      withIndex(_index: string, cb?: (q: any) => any) {
        if (cb) {
          const q: any = {};
          for (const op of ["eq", "gte", "gt", "lte", "lt"] as const) {
            q[op] = (field: string, value: unknown) => {
              // Deliberate test-only trapdoor (the throw-isolation test): a
              // toolPolicyEvents read for the configured kind simulates a
              // downstream failure so the per-kind try/catch can be
              // exercised without convex-test.
              if (
                table === "toolPolicyEvents" &&
                field === "event" &&
                value === opts.throwOnKind
              ) {
                throw new Error(`simulated toolPolicyEvents read failure for ${value}`);
              }
              predicates.push((r) => {
                const v = r[field];
                if (op === "eq") return v === value;
                if (op === "gte") return v >= (value as number);
                if (op === "gt") return v > (value as number);
                if (op === "lte") return v <= (value as number);
                return v < (value as number);
              });
              return q;
            };
          }
          cb(q);
        }
        return chain;
      },
      order(direction: "asc" | "desc") {
        dir = direction;
        return chain;
      },
      async collect() {
        const filtered = rows.filter((r) => predicates.every((p) => p(r)));
        return dir === "desc" ? [...filtered].reverse() : filtered;
      },
      async take(n: number) {
        const filtered = rows.filter((r) => predicates.every((p) => p(r)));
        const ordered = dir === "desc" ? [...filtered].reverse() : filtered;
        return ordered.slice(0, n);
      },
    };
    return chain;
  }

  const db = {
    query,
    async insert(table: string, doc: FakeDoc) {
      const row = { ...doc, _id: `${table}_${nextId}`, _creationTime: nextId };
      nextId++;
      (tables[table] ?? (tables[table] = [])).push(row);
      return row._id;
    },
    async patch() {
      throw new Error("db.patch must not be called by evaluateToolPolicyAlerts");
    },
    async delete() {
      throw new Error("db.delete must not be called by evaluateToolPolicyAlerts");
    },
  };

  const scheduler = {
    async runAfter(delay: number, fn: unknown, args: unknown) {
      schedulerCalls.push({ delay, fn, args });
    },
  };

  return { ctx: { db, scheduler } as any, tables, schedulerCalls };
}

const NOW = Date.UTC(2026, 7, 3, 15, 30, 0) / 1000; // 2026-08-03T15:30:00Z
const WINDOW_START = Math.floor(NOW / 3600) * 3600 - 3600; // completed hour, 14:00-15:00 UTC
const WINDOW_END = WINDOW_START + 3600;

function bootEvent(offsetSec: number, extra: Partial<FakeDoc> = {}): FakeDoc {
  return {
    event: "malformed_policy_boot",
    field: "tool_clusters",
    error: "yaml: line 4: mapping values are not allowed in this context",
    timestamp: WINDOW_START + offsetSec,
    ...extra,
  };
}

function reloadEvent(offsetSec: number, extra: Partial<FakeDoc> = {}): FakeDoc {
  return {
    event: "malformed_policy_reload_rejected",
    field: "tool_clusters",
    error: "yaml: line 9: bad indentation",
    timestamp: WINDOW_START + offsetSec,
    ...extra,
  };
}

function leakedEvent(offsetSec: number): FakeDoc {
  return { event: "tool_call_leaked_as_text", tool: "web_search", timestamp: WINDOW_START + offsetSec };
}

function deniedEvent(offsetSec: number): FakeDoc {
  return { event: "execution_denied", tool: "cli_gateway", timestamp: WINDOW_START + offsetSec };
}

// ---------------------------------------------------------------------------
// ALERTING_POLICY_KINDS — exactly the two fail-open kinds
// ---------------------------------------------------------------------------

describe("ALERTING_POLICY_KINDS", () => {
  test("contains exactly malformed_policy_boot and malformed_policy_reload_rejected, in that order", () => {
    expect(ALERTING_POLICY_KINDS).toEqual([
      "malformed_policy_boot",
      "malformed_policy_reload_rejected",
    ]);
  });
});

// ---------------------------------------------------------------------------
// policyAlertSeverity (F5)
// ---------------------------------------------------------------------------

describe("policyAlertSeverity", () => {
  test("malformed_policy_boot is 'error' (degrades to a fully permissive policy — the worse case)", () => {
    expect(policyAlertSeverity("malformed_policy_boot")).toBe("error");
  });

  test("malformed_policy_reload_rejected is 'warning' (fails safe — the last-known-good policy is retained)", () => {
    expect(policyAlertSeverity("malformed_policy_reload_rejected")).toBe("warning");
  });

  test("both severity values are accepted by webhookDelivery's colour map (critical|error|warning|info)", () => {
    const acceptedSeverities = new Set(["critical", "error", "warning", "info"]);
    expect(acceptedSeverities.has(policyAlertSeverity("malformed_policy_boot"))).toBe(true);
    expect(acceptedSeverities.has(policyAlertSeverity("malformed_policy_reload_rejected"))).toBe(true);
    // And the two must never collapse to the same value.
    expect(policyAlertSeverity("malformed_policy_boot")).not.toBe(
      policyAlertSeverity("malformed_policy_reload_rejected")
    );
  });
});

// ---------------------------------------------------------------------------
// buildToolPolicyAlertMessage (F6 — observes, never enforces)
// ---------------------------------------------------------------------------

const FORBIDDEN_WORDS = [
  "disable",
  "disabled",
  "block",
  "blocked",
  "revoke",
  "enforce",
  "prevent",
  "stop",
];

describe("buildToolPolicyAlertMessage", () => {
  test("boot message contains the field, a non-empty error snippet, the count, and the window start", () => {
    const message = buildToolPolicyAlertMessage({
      kind: "malformed_policy_boot",
      count: 3,
      field: "tool_clusters",
      error: "yaml: line 4: mapping values are not allowed in this context",
      windowStartSec: WINDOW_START,
    });
    expect(message).toContain("tool_clusters");
    expect(message).toContain("mapping values are not allowed");
    expect(message).toContain("3 event(s)");
    expect(message).toContain(new Date(WINDOW_START * 1000).toISOString());
    expect(message).toContain("fully permissive");
  });

  test("reload-rejected message states the previously loaded policy is still in effect", () => {
    const message = buildToolPolicyAlertMessage({
      kind: "malformed_policy_reload_rejected",
      count: 1,
      field: "tool_clusters",
      error: "bad indentation",
      windowStartSec: WINDOW_START,
    });
    expect(message).toContain("previously loaded policy is still in effect");
    expect(message).toContain("1 event(s)");
  });

  test("omits the parenthetical entirely (no 'undefined') when field/error are absent", () => {
    const message = buildToolPolicyAlertMessage({
      kind: "malformed_policy_boot",
      count: 2,
      windowStartSec: WINDOW_START,
    });
    expect(message).not.toContain("undefined");
    expect(message).not.toContain("(field");
    expect(message).toContain("2 event(s)");
  });

  test("truncates a long error to POLICY_ERROR_SNIPPET_LEN with an explicit truncation marker", () => {
    const longError = "x".repeat(POLICY_ERROR_SNIPPET_LEN + 50);
    const message = buildToolPolicyAlertMessage({
      kind: "malformed_policy_boot",
      count: 1,
      field: "tool_clusters",
      error: longError,
      windowStartSec: WINDOW_START,
    });
    expect(message).toContain("x".repeat(POLICY_ERROR_SNIPPET_LEN));
    expect(message).not.toContain("x".repeat(POLICY_ERROR_SNIPPET_LEN + 1));
    expect(message).toContain("[truncated]");
  });

  test("forbidden-word gate: neither kind's message ever contains an enforcement-implying word", () => {
    for (const kind of ALERTING_POLICY_KINDS) {
      const message = buildToolPolicyAlertMessage({
        kind,
        count: 5,
        field: "tool_clusters",
        error: "some validation error",
        windowStartSec: WINDOW_START,
      });
      const lower = message.toLowerCase();
      for (const word of FORBIDDEN_WORDS) {
        expect(lower).not.toContain(word);
      }
    }
    expect(FORBIDDEN_WORDS.length).toBeGreaterThanOrEqual(8);
  });
});

// ---------------------------------------------------------------------------
// evaluateToolPolicyAlerts — D-06 fire/dedup/isolation
// ---------------------------------------------------------------------------

describe("evaluateToolPolicyAlerts", () => {
  test("an empty window returns fired:0, skippedDeduped:0, skippedNoEvents:2 and inserts nothing", async () => {
    const { ctx, tables } = makePolicyCtx({ toolPolicyEvents: [] });
    const result = await evaluateToolPolicyAlerts(ctx, NOW);

    expect(result).toEqual({ fired: 0, skippedDeduped: 0, skippedNoEvents: 2, errors: 0 });
    expect(tables.alerts).toHaveLength(0);
  });

  test("ISOLATION CONTROL (D-06 negative control): a window with only tool_call_leaked_as_text and execution_denied fires ZERO alerts and inserts nothing", async () => {
    const { ctx, tables } = makePolicyCtx({
      toolPolicyEvents: [leakedEvent(10), leakedEvent(20), deniedEvent(30)],
    });
    const result = await evaluateToolPolicyAlerts(ctx, NOW);

    expect(result.fired).toBe(0);
    expect(result.skippedNoEvents).toBe(2); // neither alerting kind had any events
    expect(tables.alerts).toHaveLength(0);
  });

  test("N boot events in one hour fire exactly ONE alert, with the count of N stated in the message", async () => {
    const events = [10, 20, 30, 40, 50, 60, 70].map((offset) => bootEvent(offset));
    const { ctx, tables } = makePolicyCtx({ toolPolicyEvents: events });
    const result = await evaluateToolPolicyAlerts(ctx, NOW);

    expect(result.fired).toBe(1);
    expect(tables.alerts).toHaveLength(1);
    expect(tables.alerts[0].message).toContain("7 event(s)");
    expect(tables.alerts[0].details.count).toBe(7);
  });

  test("dedup: running the evaluator twice over the same hour fires once and reports skippedDeduped:1 on the second run, with the alert row count still 1", async () => {
    const { ctx, tables } = makePolicyCtx({ toolPolicyEvents: [bootEvent(10), bootEvent(20)] });

    const first = await evaluateToolPolicyAlerts(ctx, NOW);
    const second = await evaluateToolPolicyAlerts(ctx, NOW);

    expect(first.fired).toBe(1);
    expect(second.fired).toBe(0);
    expect(second.skippedDeduped).toBe(1);
    expect(tables.alerts).toHaveLength(1);
  });

  test("an escalation across kinds is not suppressed: a boot alert and a reload-rejected alert in the same hour both fire, with different source strings", async () => {
    const { ctx, tables } = makePolicyCtx({
      toolPolicyEvents: [bootEvent(10), reloadEvent(15)],
    });
    const result = await evaluateToolPolicyAlerts(ctx, NOW);

    expect(result.fired).toBe(2);
    expect(tables.alerts).toHaveLength(2);
    const sources = tables.alerts.map((a) => a.source).sort();
    expect(sources).toEqual(["tool-policy:malformed_policy_boot", "tool-policy:malformed_policy_reload_rejected"]);
  });

  test("a throw while evaluating one kind does not prevent the other kind from being evaluated", async () => {
    const { ctx, tables } = makePolicyCtx({
      toolPolicyEvents: [bootEvent(10), reloadEvent(15)],
      throwOnKind: "malformed_policy_boot",
    });
    const result = await evaluateToolPolicyAlerts(ctx, NOW);

    expect(result.errors).toBe(1);
    expect(result.fired).toBe(1); // reload-rejected still evaluated and fired
    expect(tables.alerts).toHaveLength(1);
    expect(tables.alerts[0].source).toBe("tool-policy:malformed_policy_reload_rejected");
  });

  test("severity/webhookStatus/schedule shape: an alert is inserted with the right severity and 'pending' webhookStatus, and exactly one scheduler.runAfter call is recorded", async () => {
    const { ctx, tables, schedulerCalls } = makePolicyCtx({ toolPolicyEvents: [bootEvent(10)] });
    await evaluateToolPolicyAlerts(ctx, NOW);

    expect(tables.alerts[0].severity).toBe("error");
    expect(tables.alerts[0].webhookStatus).toBe("pending");
    expect(tables.alerts[0].acknowledged).toBe(false);
    expect(tables.alerts[0].status).toBe("active");
    expect(schedulerCalls).toHaveLength(1);
    expect(schedulerCalls[0].delay).toBe(0);
    expect(schedulerCalls[0].args).toMatchObject({ alertId: tables.alerts[0]._id, attempt: 1 });
  });

  test("details.windowStart is the completed-hour boundary, used as the dedup key", async () => {
    const { ctx, tables } = makePolicyCtx({ toolPolicyEvents: [bootEvent(10)] });
    await evaluateToolPolicyAlerts(ctx, NOW);

    expect(tables.alerts[0].details.windowStart).toBe(WINDOW_START);
    expect(tables.alerts[0].details.windowEnd).toBe(WINDOW_END);
  });

  test("a cap-hit window reports details.truncated: true", async () => {
    const events = Array.from({ length: POLICY_EVENT_READ_CAP }, (_, i) => bootEvent(i % 3599));
    const { ctx, tables } = makePolicyCtx({ toolPolicyEvents: events });
    await evaluateToolPolicyAlerts(ctx, NOW);

    expect(tables.alerts[0].details.truncated).toBe(true);
    expect(tables.alerts[0].details.count).toBe(POLICY_EVENT_READ_CAP);
  });

  test("D-06 guard: the only mutation evaluateToolPolicyAlerts performs is the alerts insert — toolPolicyEvents is never written", async () => {
    const { ctx, tables } = makePolicyCtx({ toolPolicyEvents: [bootEvent(10)] });
    await evaluateToolPolicyAlerts(ctx, NOW);

    expect(tables.toolPolicyEvents).toHaveLength(1); // unchanged (seed row only)
    expect(tables.alerts).toHaveLength(1); // the one and only write
  });
});
