import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  record,
  listRecent,
  channelSummary,
  MESSAGE_ROUTE_CAP,
  MESSAGE_ROUTE_SUMMARY_CAP,
  MESSAGE_ROUTE_SUMMARY_WINDOW_DAYS,
} from "./messageRoutes";

// Tests for Phase 112 (TELE-03, D-13): messageRoutes backend service

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Strip full-line comments (// or *-prefixed doc-comment lines) so a
 * docstring that legitimately mentions the words "mutation" or "record"
 * cannot pollute a source-level grep-style assertion. Copied verbatim from
 * controlVerbSwaps.test.ts, which itself copied it from activeEngine.test.ts. */
function stripCommentLines(source: string): string {
  return source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");
}

describe("record args shape (read from the live validator, not a hand-typed literal)", () => {
  function recordArgFields(): Record<string, { fieldType: { type: string }; optional: boolean }> {
    const exportArgs = (record as unknown as { exportArgs: () => string }).exportArgs;
    const schema = JSON.parse(exportArgs());
    return schema.value;
  }

  it("declares channel/profile/timestamp as required (non-optional)", () => {
    const fields = recordArgFields();
    expect(fields.channel.optional).toBe(false);
    expect(fields.profile.optional).toBe(false);
    expect(fields.timestamp.optional).toBe(false);
  });

  it("declares sender/sessionId as optional", () => {
    const fields = recordArgFields();
    expect(fields.sender.optional).toBe(true);
    expect(fields.sessionId.optional).toBe(true);
  });

  it("declares timestamp as a numeric field (matches v.float64())", () => {
    const fields = recordArgFields();
    expect(fields.timestamp.fieldType.type).toBe("number");
  });
});

// CR-01 guard: record must be an internalMutation, never a public mutation.
// Same shape as controlVerbSwaps.test.ts / governorDecisions.test.ts.
describe("CR-01 — record authorization boundary (source-level guard)", () => {
  const messageRoutesPath = path.resolve(__dirname, "./messageRoutes.ts");

  it("declares record with internalMutation, never with a public mutation builder", () => {
    const source = stripCommentLines(readFileSync(messageRoutesPath, "utf-8"));
    expect(source).toMatch(/record\s*=\s*internalMutation\(/);
    expect(source).not.toMatch(/=\s*mutation\(/);
  });

  it("stays true even though the file's own docstrings mention the word 'mutation'", () => {
    // Sanity check on the stripping itself: the raw (unstripped) file DOES
    // contain the word "mutation" in prose — if it didn't, the negative
    // assertion above would be vacuous.
    const raw = readFileSync(messageRoutesPath, "utf-8");
    expect(raw).toMatch(/mutation/i);
  });
});

describe("bounded read — listRecent never .collect()s", () => {
  const messageRoutesPath = path.resolve(__dirname, "./messageRoutes.ts");

  it("uses .take( and never .collect( on the append-only table", () => {
    const source = stripCommentLines(readFileSync(messageRoutesPath, "utf-8"));
    expect(source).toMatch(/\.take\(/);
    expect(source).not.toMatch(/\.collect\(/);
  });

  it("declares MESSAGE_ROUTE_CAP IN THIS FILE (deliberate difference from governorDecisions — no filters module, per <decided_shapes>)", () => {
    const source = stripCommentLines(readFileSync(messageRoutesPath, "utf-8"));
    expect(source).toMatch(/export const MESSAGE_ROUTE_CAP\s*=\s*50/);
    expect(source).toMatch(/\.take\(MESSAGE_ROUTE_CAP\)/);
  });

  it("MESSAGE_ROUTE_CAP constant equals 50", () => {
    expect(MESSAGE_ROUTE_CAP).toBe(50);
  });

  it("has no sibling messageRoutesFilters.ts module", () => {
    const filtersPath = path.resolve(__dirname, "./messageRoutesFilters.ts");
    expect(() => readFileSync(filtersPath, "utf-8")).toThrow();
  });
});

describe("listRecent — declared as query({ args: {}, ... }), takes no arguments", () => {
  it("has an empty args object validator (read from the live validator)", () => {
    const exportArgs = (listRecent as unknown as { exportArgs: () => string }).exportArgs;
    const schema = JSON.parse(exportArgs());
    expect(schema.type).toBe("object");
    expect(Object.keys(schema.value)).toEqual([]);
  });

  it("is registered with query(, not internalMutation/mutation — record stays the file's only internalMutation( (CR-01 regression guard)", () => {
    const messageRoutesPath = path.resolve(__dirname, "./messageRoutes.ts");
    const source = stripCommentLines(readFileSync(messageRoutesPath, "utf-8"));
    expect(source).toMatch(/listRecent\s*=\s*query\(/);
    const internalMutationMatches = source.match(/=\s*internalMutation\(/g) ?? [];
    expect(internalMutationMatches.length).toBe(1);
    expect(source).not.toMatch(/=\s*mutation\(/);
  });
});

// D-13 recorded in the file itself: routed but deliberately not surfaced in
// the UI this phase. That follow-up is now CLOSED by `channelSummary` and
// src/components/MessageRoutingSummary.tsx; the decision trail stays recorded
// in the module either way.
describe("D-13 — the decision trail stays recorded in the module", () => {
  it("the file source contains the string D-13", () => {
    const messageRoutesPath = path.resolve(__dirname, "./messageRoutes.ts");
    const raw = readFileSync(messageRoutesPath, "utf-8");
    expect(raw).toContain("D-13");
  });
});

// ============================================================
// channelSummary — aggregation behaviour (D-13's closed follow-up)
// ============================================================
//
// The bound on this query's READ is guarded separately, in
// messageRoutesBounded.test.ts, by asserting on the recorded query. These
// tests cover what it computes from the rows it gets back.

const DAY = 86400;

function makeDb(rows: any[]) {
  const chain: any = {
    withIndex: () => chain,
    order: () => chain,
    take: async () => rows,
  };
  return { query: () => chain };
}

function mrow(overrides: Partial<any> = {}) {
  return {
    _id: "m1",
    channel: "telegram",
    profile: "personal",
    sender: "5550101234",
    sessionId: "session-a",
    timestamp: Math.floor(Date.now() / 1000) - 60,
    ...overrides,
  };
}

async function summarize(rows: any[]) {
  return (await (channelSummary as any)._handler(
    { db: makeDb(rows) } as any,
    {}
  )) as any;
}

describe("channelSummary — channel mix", () => {
  it("counts per channel and sorts busiest first", async () => {
    const out = await summarize([
      mrow({ channel: "whatsapp" }),
      mrow({ channel: "telegram" }),
      mrow({ channel: "telegram" }),
      mrow({ channel: "telegram" }),
    ]);

    expect(out.channels).toEqual([
      expect.objectContaining({ channel: "telegram", count: 3 }),
      expect.objectContaining({ channel: "whatsapp", count: 1 }),
    ]);
    expect(out.total).toBe(4);
  });

  it("breaks count ties by channel name so the render order cannot flicker", async () => {
    const out = await summarize([
      mrow({ channel: "whatsapp" }),
      mrow({ channel: "telegram" }),
    ]);
    expect(out.channels.map((c: any) => c.channel)).toEqual([
      "telegram",
      "whatsapp",
    ]);
  });

  it("dedupes and sorts senders within a channel", async () => {
    const out = await summarize([
      mrow({ sender: "5550101234" }),
      mrow({ sender: "5550101234" }),
      mrow({ sender: "1234567890" }),
    ]);
    expect(out.channels[0].senders).toEqual(["1234567890", "5550101234"]);
  });

  it("omits a missing sender rather than emitting undefined into the list", async () => {
    // `sender` is optional in the schema precisely because astridr can send an
    // explicit null (the TELE-02 carve-out). An undefined leaking into
    // `senders` would reach the masker and render as the string "undefined".
    const out = await summarize([
      mrow({ sender: undefined }),
      mrow({ sender: "5550101234" }),
    ]);
    expect(out.channels[0].senders).toEqual(["5550101234"]);
    expect(out.channels[0].count).toBe(2);
  });
});

describe("channelSummary — cardinality behind the mix", () => {
  it("dedupes and sorts profiles", async () => {
    const out = await summarize([
      mrow({ profile: "work" }),
      mrow({ profile: "personal" }),
      mrow({ profile: "personal" }),
    ]);
    expect(out.profiles).toEqual(["personal", "work"]);
  });

  it("counts DISTINCT sessions, not rows", async () => {
    const out = await summarize([
      mrow({ sessionId: "a" }),
      mrow({ sessionId: "a" }),
      mrow({ sessionId: "b" }),
    ]);
    expect(out.total).toBe(3);
    expect(out.sessionCount).toBe(2);
  });

  it("does not count a missing sessionId as a session", async () => {
    const out = await summarize([
      mrow({ sessionId: undefined }),
      mrow({ sessionId: "a" }),
    ]);
    expect(out.sessionCount).toBe(1);
  });
});

describe("channelSummary — daily buckets", () => {
  it("returns exactly windowDays buckets", async () => {
    const out = await summarize([mrow()]);
    expect(out.windowDays).toBe(MESSAGE_ROUTE_SUMMARY_WINDOW_DAYS);
    expect(out.daily).toHaveLength(MESSAGE_ROUTE_SUMMARY_WINDOW_DAYS);
  });

  it("orders buckets oldest-first, so a recent row lands after an older one", async () => {
    const now = Math.floor(Date.now() / 1000);
    const out = await summarize([
      mrow({ timestamp: now - 60 }), // today
      mrow({ timestamp: now - 10 * DAY }), // ten days ago
    ]);

    const filled = out.daily
      .map((n: number, i: number) => ({ n, i }))
      .filter((b: { n: number }) => b.n > 0)
      .map((b: { i: number }) => b.i);

    expect(filled).toHaveLength(2);
    // Oldest-first ordering: the 10-day-old row sits at a LOWER index than
    // today's. If the array were newest-first this comparison inverts.
    expect(filled[0]).toBeLessThan(filled[1]);
    expect(filled[1]).toBe(MESSAGE_ROUTE_SUMMARY_WINDOW_DAYS - 1);
    expect(out.daily.reduce((a: number, b: number) => a + b, 0)).toBe(2);
  });

  it("clamps a row sitting exactly on the window boundary into the array", async () => {
    // A row at the cutoff computes bucket 0; one a hair older computes -1 and
    // would write to daily[-1], silently vanishing from the total.
    const now = Math.floor(Date.now() / 1000);
    const out = await summarize([
      mrow({ timestamp: now - MESSAGE_ROUTE_SUMMARY_WINDOW_DAYS * DAY - 5 }),
    ]);
    expect(out.daily).toHaveLength(MESSAGE_ROUTE_SUMMARY_WINDOW_DAYS);
    expect(out.daily.reduce((a: number, b: number) => a + b, 0)).toBe(1);
    expect(out.daily[0]).toBe(1);
  });
});

describe("channelSummary — cap disclosure", () => {
  it("reports atCap false when the window is not full", async () => {
    const out = await summarize([mrow(), mrow()]);
    expect(out.atCap).toBe(false);
  });

  it("reports atCap true once the read returns the cap, so the UI can say so instead of truncating silently", async () => {
    const rows = Array.from({ length: MESSAGE_ROUTE_SUMMARY_CAP }, (_, i) =>
      mrow({ _id: `m${i}` })
    );
    const out = await summarize(rows);
    expect(out.atCap).toBe(true);
    expect(out.total).toBe(MESSAGE_ROUTE_SUMMARY_CAP);
  });
});

describe("channelSummary — empty window", () => {
  it("returns a zeroed summary rather than throwing, so the UI can render an empty state", async () => {
    const out = await summarize([]);
    expect(out.total).toBe(0);
    expect(out.channels).toEqual([]);
    expect(out.profiles).toEqual([]);
    expect(out.sessionCount).toBe(0);
    expect(out.atCap).toBe(false);
    expect(out.daily).toHaveLength(MESSAGE_ROUTE_SUMMARY_WINDOW_DAYS);
    expect(out.daily.every((n: number) => n === 0)).toBe(true);
  });
});

describe("channelSummary — declared as query({ args: {} })", () => {
  it("has an empty args object validator (read from the live validator)", () => {
    const exportArgs = (channelSummary as unknown as { exportArgs: () => string })
      .exportArgs;
    const schema = JSON.parse(exportArgs());
    expect(schema.type).toBe("object");
    expect(Object.keys(schema.value)).toEqual([]);
  });
});
