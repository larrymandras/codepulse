/**
 * missionWatch.test.ts — the MISSION-01 watcher.
 *
 * Two properties matter and they pull in opposite directions, so both need
 * proving: it MUST fire when the condition flips, and it must NEVER fire twice.
 * A watcher that only satisfies the first becomes a daily nag nobody reads; one
 * that only satisfies the second is indistinguishable from a watcher that is
 * broken. Tests below assert on what was WRITTEN, not on the handler's return
 * value — a verb's success payload is never evidence it behaved.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkMission01,
  hasRealDuration,
  MISSION01_ALERT_SOURCE,
  MISSION01_SCAN_CAP,
} from "./missionWatch";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function makeDb(seed: { subagentJobs?: any[]; alerts?: any[] } = {}) {
  const tables: Record<string, any[]> = {
    subagentJobs: [...(seed.subagentJobs ?? [])],
    alerts: [...(seed.alerts ?? [])],
  };
  const takes: number[] = [];
  let n = 0;

  const db = {
    query(table: string) {
      const eqs: Array<[string, unknown]> = [];
      let desc = false;
      const chain: any = {
        withIndex(_i: string, cb?: (q: any) => any) {
          if (cb) {
            const q: any = {};
            for (const op of ["eq", "gte", "gt", "lte", "lt"]) {
              q[op] = (f: string, v: unknown) => {
                if (op === "eq") eqs.push([f, v]);
                return q;
              };
            }
            cb(q);
          }
          return chain;
        },
        order(d: string) {
          desc = d === "desc";
          return chain;
        },
        filter() {
          return chain;
        },
        rows() {
          let out = (tables[table] ?? []).filter((r) =>
            eqs.every(([f, v]) => r[f] === v)
          );
          if (desc) out = [...out].reverse();
          return out;
        },
        async first() {
          return chain.rows()[0] ?? null;
        },
        async take(k: number) {
          takes.push(k);
          return chain.rows().slice(0, k);
        },
        async collect() {
          return chain.rows();
        },
      };
      return chain;
    },
    async insert(table: string, doc: any) {
      const _id = `${table}-${++n}`;
      tables[table].push({ _id, ...doc });
      return _id;
    },
  };
  return { db, tables, takes };
}

function job(overrides: Partial<any> = {}) {
  return {
    _id: "j1",
    jobId: "job-abc",
    status: "completed",
    submittedAt: 1_787_700_000,
    finishedAt: 1_787_700_000, // the live shape: identical, so NO real duration
    ...overrides,
  };
}

const run = (db: any) => (checkMission01 as any)._handler({ db } as any, {});

// ============================================================
// hasRealDuration
// ============================================================

describe("hasRealDuration", () => {
  it("is false when the two stamps are identical — the live state of all 7 rows", () => {
    expect(hasRealDuration({ submittedAt: 100, finishedAt: 100 })).toBe(false);
  });

  it("is true only when finished is strictly AFTER submitted", () => {
    expect(hasRealDuration({ submittedAt: 100, finishedAt: 101 })).toBe(true);
  });

  it("is false for a BACKWARDS row, which `!==` would wrongly accept", () => {
    // The handoff's documented probe uses `!==`. A row finishing before it was
    // submitted is a clock anomaly, not evidence the duration plumbing works.
    expect(hasRealDuration({ submittedAt: 100, finishedAt: 99 })).toBe(false);
  });

  it("is false when either stamp is missing or null", () => {
    expect(hasRealDuration({ submittedAt: 100, finishedAt: null })).toBe(false);
    expect(hasRealDuration({ submittedAt: null, finishedAt: 100 })).toBe(false);
    expect(hasRealDuration({})).toBe(false);
  });
});

// ============================================================
// Does not fire while the condition is unmet
// ============================================================

describe("checkMission01 — stays silent until the condition flips", () => {
  it("writes nothing against the live shape (7 rows, submittedAt === finishedAt)", async () => {
    const { db, tables } = makeDb({
      subagentJobs: Array.from({ length: 7 }, (_, i) =>
        job({ _id: `j${i}`, jobId: `job-${i}` })
      ),
    });
    const out: any = await run(db);

    expect(tables.alerts).toHaveLength(0);
    expect(out.raised).toBe(false);
    expect(out.reason).toBe("not-yet");
    expect(out.scanned).toBe(7);
  });

  it("writes nothing on an empty table", async () => {
    const { db, tables } = makeDb();
    const out: any = await run(db);
    expect(tables.alerts).toHaveLength(0);
    expect(out.raised).toBe(false);
  });

  it("ignores an in-flight row with no finishedAt", async () => {
    const { db, tables } = makeDb({
      subagentJobs: [job({ status: "running", finishedAt: null })],
    });
    await run(db);
    expect(tables.alerts).toHaveLength(0);
  });
});

// ============================================================
// Fires once when it flips
// ============================================================

describe("checkMission01 — raises exactly one alert when the condition is met", () => {
  it("writes an alert once a row carries a real duration", async () => {
    const { db, tables } = makeDb({
      subagentJobs: [
        job({ _id: "old" }),
        job({ _id: "real", jobId: "job-real", submittedAt: 100, finishedAt: 412 }),
      ],
    });
    const out: any = await run(db);

    expect(out.raised).toBe(true);
    expect(tables.alerts).toHaveLength(1);

    const alert = tables.alerts[0];
    expect(alert.source).toBe(MISSION01_ALERT_SOURCE);
    expect(alert.acknowledged).toBe(false);
    expect(alert.status).toBe("active");
    expect(alert.message).toContain("MISSION-01");
    expect(alert.details.satisfyingRows).toBe(1);
    expect(alert.details.sampleDurationSeconds).toBe(312);
  });

  it("stamps createdAt in epoch SECONDS, like every other writer of this table", async () => {
    const { db, tables } = makeDb({
      subagentJobs: [job({ submittedAt: 100, finishedAt: 200 })],
    });
    await run(db);

    const createdAt = tables.alerts[0].createdAt;
    expect(Math.abs(createdAt - Date.now() / 1000)).toBeLessThan(5);
    // A millis stamp would sort this alert ~55,000 years into the future and
    // quietly break every by_*_createdAt range that reads the table.
    expect(createdAt).toBeLessThan(100_000_000_000);
  });

  it("tells the reader NOT to let tooling tick the requirement", async () => {
    // The whole reason this watcher does not tick it itself: GSD tooling
    // auto-ticked MISSION-01 twice and it was reverted both times.
    const { db, tables } = makeDb({
      subagentJobs: [job({ submittedAt: 1, finishedAt: 2 })],
    });
    await run(db);
    expect(tables.alerts[0].message.toLowerCase()).toContain("by hand");
  });
});

// ============================================================
// Never fires twice
// ============================================================

describe("checkMission01 — idempotent", () => {
  it("does not raise a second alert on the next run", async () => {
    const { db, tables } = makeDb({
      subagentJobs: [job({ submittedAt: 100, finishedAt: 200 })],
    });

    const first: any = await run(db);
    const second: any = await run(db);
    const third: any = await run(db);

    expect(first.raised).toBe(true);
    expect(second.raised).toBe(false);
    expect(second.reason).toBe("already-raised");
    expect(third.raised).toBe(false);
    expect(tables.alerts).toHaveLength(1);
  });

  it("keys idempotency on the alert SOURCE, not on acknowledgement", async () => {
    // Acknowledging the alert on /alerts must not re-arm the watcher — that
    // would turn a one-shot notice into a daily nag the moment it is dismissed.
    const { db, tables } = makeDb({
      subagentJobs: [job({ submittedAt: 100, finishedAt: 200 })],
      alerts: [
        {
          _id: "prior",
          source: MISSION01_ALERT_SOURCE,
          acknowledged: true,
          status: "resolved",
          createdAt: 1,
        },
      ],
    });
    const out: any = await run(db);

    expect(out.raised).toBe(false);
    expect(tables.alerts).toHaveLength(1);
  });

  it("an unrelated alert does not suppress it (control)", async () => {
    // Without this, an idempotency check that matched ANY alert would look
    // identical to a correct one on a table that happens to be non-empty.
    const { db, tables } = makeDb({
      subagentJobs: [job({ submittedAt: 100, finishedAt: 200 })],
      alerts: [
        { _id: "other", source: "some-other-source", acknowledged: false, createdAt: 1 },
      ],
    });
    const out: any = await run(db);

    expect(out.raised).toBe(true);
    expect(tables.alerts).toHaveLength(2);
  });
});

// ============================================================
// Bounded read + authorization
// ============================================================

describe("checkMission01 — read is bounded and the write is not client-callable", () => {
  it("takes at most MISSION01_SCAN_CAP rows, never collects", async () => {
    const { db, takes } = makeDb({
      subagentJobs: Array.from({ length: 500 }, (_, i) => job({ _id: `j${i}` })),
    });
    await run(db);
    expect(takes).toContain(MISSION01_SCAN_CAP);
  });

  it("is declared internalMutation, never a public mutation", () => {
    // A plain `mutation` lands in the client-callable `api.` namespace, letting
    // anyone with the shipped VITE_CONVEX_URL forge a "MISSION-01 is satisfied"
    // alert. Same CR-01/INT-03 rule as the rest of this repo's writes.
    const source = readFileSync(path.join(__dirname, "missionWatch.ts"), "utf-8")
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");

    expect(source).toMatch(/checkMission01\s*=\s*internalMutation\(/);
    expect(source).not.toMatch(/=\s*mutation\(/);
  });

  it("is wired into crons.ts (a watcher nobody schedules is not a watcher)", () => {
    const crons = readFileSync(path.join(__dirname, "crons.ts"), "utf-8");
    expect(crons).toContain("internal.missionWatch.checkMission01");
    expect(crons).toContain("mission-01-watch");
  });
});
