/**
 * Phase 101 Plan 01 (REM-01/REM-04) — reminders Convex module unit tests.
 *
 * Uses plain vitest — convex-test is NOT installed in this repo
 * (see convex/runtimeIngest.test.ts:9). CRUD mutations/queries are tested
 * against a minimal in-memory fake `ctx.db` (mirrors the pattern in
 * convex/evalScores.test.ts's `storeEvalScoreHandler` coverage).
 */
import { describe, it, expect } from "vitest";
import {
  computeNextDueAt,
  createReminderHandler,
  updateReminderHandler,
  completeReminderHandler,
  snoozeReminderHandler,
  markNotifiedHandler,
  removeReminderHandler,
  listByProfileHandler,
  dueSoonHandler,
  overdueHandler,
} from "./reminders";

// ---------------------------------------------------------------------------
// Task 2 — computeNextDueAt (pure, unit-first)
// ---------------------------------------------------------------------------

// Epoch-seconds fixture helper (matches profiles.ts Date.now()/1000 convention).
const day = (y: number, m: number, d: number, h = 9) =>
  Math.floor(Date.UTC(y, m - 1, d, h, 0, 0) / 1000);

describe("computeNextDueAt", () => {
  it("advances daily by interval days", () => {
    const due = day(2026, 3, 10);
    expect(computeNextDueAt(due, { freq: "daily", interval: 1 })).toBe(
      day(2026, 3, 11)
    );
  });

  it("advances daily by a multi-day interval", () => {
    const due = day(2026, 3, 10);
    expect(computeNextDueAt(due, { freq: "daily", interval: 3 })).toBe(
      day(2026, 3, 13)
    );
  });

  it("advances weekly by interval weeks with no byday", () => {
    const due = day(2026, 3, 10); // Tuesday
    expect(computeNextDueAt(due, { freq: "weekly", interval: 1 })).toBe(
      day(2026, 3, 17)
    );
  });

  it("advances weekly by a multi-week interval", () => {
    const due = day(2026, 3, 10);
    expect(computeNextDueAt(due, { freq: "weekly", interval: 2 })).toBe(
      day(2026, 3, 24)
    );
  });

  it("selects the next matching byday weekday for weekly recurrence", () => {
    const due = day(2026, 3, 9); // Monday
    const next = computeNextDueAt(due, {
      freq: "weekly",
      interval: 1,
      byday: ["MO", "WE", "FR"],
    });
    // Next matching weekday strictly after Monday is Wednesday 2026-03-11.
    expect(next).toBe(day(2026, 3, 11));
  });

  it("advances monthly by interval months", () => {
    const due = day(2026, 1, 15);
    expect(computeNextDueAt(due, { freq: "monthly", interval: 1 })).toBe(
      day(2026, 2, 15)
    );
  });

  it("clamps end-of-month overflow (Jan 31 -> Feb 28, non-leap year)", () => {
    const due = day(2026, 1, 31);
    expect(computeNextDueAt(due, { freq: "monthly", interval: 1 })).toBe(
      day(2026, 2, 28)
    );
  });

  it("clamps end-of-month overflow across a leap year (Jan 31 2028 -> Feb 29)", () => {
    const due = day(2028, 1, 31);
    expect(computeNextDueAt(due, { freq: "monthly", interval: 1 })).toBe(
      day(2028, 2, 29)
    );
  });

  it("returns null when the computed next occurrence is past `until`", () => {
    const due = day(2026, 3, 10);
    const until = day(2026, 3, 12); // before the computed next (2026-03-17)
    expect(
      computeNextDueAt(due, { freq: "weekly", interval: 1, until })
    ).toBeNull();
  });

  it("returns the next occurrence when it lands exactly on `until`", () => {
    const due = day(2026, 3, 10);
    const until = day(2026, 3, 11); // exactly the computed next (daily +1)
    expect(
      computeNextDueAt(due, { freq: "daily", interval: 1, until })
    ).toBe(until);
  });

  it("returns null for a one-off (no recurrence)", () => {
    const due = day(2026, 3, 10);
    expect(computeNextDueAt(due, undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Task 3 — CRUD mutations + queries
// ---------------------------------------------------------------------------
//
// mutation()/query()-wrapped Convex functions need a real ctx, which
// convex-test would normally provide — not installed in this repo (see
// convex/runtimeIngest.test.ts:9). Instead the business logic is extracted
// into plain exported "*Handler" functions taking a minimal in-memory fake
// `ctx.db` (mirrors convex/evalScores.test.ts's storeEvalScoreHandler
// coverage), with `now` passed explicitly so tests stay deterministic.

function makeFakeDb() {
  let idCounter = 0;
  const rows = new Map<string, any>();
  return {
    rows,
    async insert(_table: string, doc: any) {
      const id = `id_${idCounter++}`;
      rows.set(id, { _id: id, ...doc });
      return id;
    },
    async get(id: string) {
      return rows.get(id) ?? null;
    },
    async patch(id: string, patch: Record<string, unknown>) {
      const existing = rows.get(id);
      if (existing) rows.set(id, { ...existing, ...patch });
    },
    async delete(id: string) {
      rows.delete(id);
    },
    query(_table: string) {
      const list = () => Array.from(rows.values());
      return {
        withIndex(_indexName: string, cb?: (q: any) => any) {
          let filtered = list();
          if (cb) {
            const conditions: Array<[string, any]> = [];
            const qProxy = {
              eq(field: string, value: any) {
                conditions.push([field, value]);
                return qProxy;
              },
            };
            cb(qProxy);
            filtered = filtered.filter((r) =>
              conditions.every(([f, v]) => r[f] === v)
            );
          }
          return {
            collect: async () => filtered,
            first: async () => filtered[0] ?? null,
          };
        },
      };
    },
  };
}

describe("reminders CRUD handlers", () => {
  it("create -> listByProfile roundtrip", async () => {
    const db = makeFakeDb();
    const id = await createReminderHandler(
      { db },
      { profileId: "personal", title: "Water plants", source: "dashboard" },
      1000
    );
    const rows = await listByProfileHandler({ db }, "personal");
    expect(rows).toHaveLength(1);
    expect(rows[0]._id).toBe(id);
    expect(rows[0].title).toBe("Water plants");
    expect(rows[0].status).toBe("open");
    expect(rows[0].priority).toBe("med");
    expect(rows[0].createdAt).toBe(1000);
    expect(rows[0].updatedAt).toBe(1000);
  });

  it("listByProfile only returns rows for the requested profile", async () => {
    const db = makeFakeDb();
    await createReminderHandler(
      { db },
      { profileId: "personal", title: "A", source: "dashboard" },
      1000
    );
    await createReminderHandler(
      { db },
      { profileId: "business", title: "B", source: "dashboard" },
      1000
    );
    const rows = await listByProfileHandler({ db }, "personal");
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("A");
  });

  it("create requires source and stores 'dashboard' verbatim", async () => {
    const db = makeFakeDb();
    await createReminderHandler(
      { db },
      { profileId: "personal", title: "A", source: "dashboard" },
      1000
    );
    const rows = await listByProfileHandler({ db }, "personal");
    expect(rows[0].source).toBe("dashboard");
  });

  it("create stores 'astridr' as the source verbatim", async () => {
    const db = makeFakeDb();
    await createReminderHandler(
      { db },
      { profileId: "personal", title: "A", source: "astridr" },
      1000
    );
    const rows = await listByProfileHandler({ db }, "personal");
    expect(rows[0].source).toBe("astridr");
  });

  it("update patches allowed fields and bumps updatedAt", async () => {
    const db = makeFakeDb();
    const id = await createReminderHandler(
      { db },
      { profileId: "personal", title: "Old title", source: "dashboard" },
      1000
    );
    await updateReminderHandler({ db }, id, { title: "New title" }, 2000);
    const row = await db.get(id);
    expect(row.title).toBe("New title");
    expect(row.updatedAt).toBe(2000);
  });

  it("create rejects recurrence.interval 0, negative, and non-integer values (WR-02)", async () => {
    const db = makeFakeDb();
    for (const interval of [0, -1, 1.5]) {
      await expect(
        createReminderHandler(
          { db },
          {
            profileId: "personal",
            title: "Bad interval",
            dueAt: 1000,
            source: "dashboard",
            recurrence: { freq: "daily", interval },
          },
          500
        )
      ).rejects.toThrow(/interval must be an integer >= 1/);
    }
    // Nothing was inserted — interval 0 would otherwise spawn an identical
    // open row on every nudge-cron auto-roll, forever.
    expect(db.rows.size).toBe(0);
  });

  it("update rejects an invalid recurrence.interval but accepts a valid one (WR-02)", async () => {
    const db = makeFakeDb();
    const id = await createReminderHandler(
      { db },
      { profileId: "personal", title: "R", source: "dashboard" },
      500
    );
    await expect(
      updateReminderHandler(
        { db },
        id,
        { recurrence: { freq: "weekly", interval: 0 } },
        1000
      )
    ).rejects.toThrow(/interval must be an integer >= 1/);
    expect((await db.get(id)).recurrence).toBeUndefined();

    await updateReminderHandler(
      { db },
      id,
      { recurrence: { freq: "weekly", interval: 2 } },
      1000
    );
    expect((await db.get(id)).recurrence).toEqual({ freq: "weekly", interval: 2 });
  });

  it("completing a one-off reminder sets status done and spawns no row", async () => {
    const db = makeFakeDb();
    const id = await createReminderHandler(
      { db },
      { profileId: "personal", title: "One-off", dueAt: 1000, source: "dashboard" },
      500
    );
    await completeReminderHandler({ db }, id, 1500);
    expect(db.rows.size).toBe(1);
    const row = await db.get(id);
    expect(row.status).toBe("done");
    expect(row.completedAt).toBe(1500);
    expect(row.updatedAt).toBe(1500);
  });

  it("completing a recurring reminder spawns exactly one next-open row with cleared notifiedAt", async () => {
    const db = makeFakeDb();
    const dueAt = day(2026, 3, 10);
    const id = await createReminderHandler(
      { db },
      {
        profileId: "personal",
        title: "Recurring",
        dueAt,
        source: "dashboard",
        recurrence: { freq: "daily", interval: 1 },
      },
      500
    );
    // Simulate the Ástríðr nudge cron having set notifiedAt on the original.
    await db.patch(id, { notifiedAt: 999 });

    await completeReminderHandler({ db }, id, 1500);

    expect(db.rows.size).toBe(2);
    const original = await db.get(id);
    expect(original.status).toBe("done");
    expect(original.completedAt).toBe(1500);

    const spawned = Array.from(db.rows.values()).find(
      (r: any) => r._id !== id
    ) as any;
    expect(spawned).toBeDefined();
    expect(spawned.status).toBe("open");
    expect(spawned.dueAt).toBe(computeNextDueAt(dueAt, { freq: "daily", interval: 1 }));
    expect(spawned.notifiedAt).toBeUndefined();
    expect(spawned.title).toBe("Recurring");
    expect(spawned.profileId).toBe("personal");
    expect(spawned.source).toBe("dashboard");
  });

  it("complete is idempotent: a second complete on a done recurring reminder spawns no duplicate (WR-01)", async () => {
    const db = makeFakeDb();
    const dueAt = day(2026, 3, 10);
    const id = await createReminderHandler(
      { db },
      {
        profileId: "personal",
        title: "Raced",
        dueAt,
        source: "dashboard",
        recurrence: { freq: "daily", interval: 1 },
      },
      500
    );

    // The nudge cron auto-rolls (op:complete) racing Larry's dashboard click.
    await completeReminderHandler({ db }, id, 1500);
    await completeReminderHandler({ db }, id, 1600);

    // Exactly ONE next occurrence spawned, and the second call didn't
    // re-patch the done row's timestamps.
    expect(db.rows.size).toBe(2);
    const original = await db.get(id);
    expect(original.completedAt).toBe(1500);
    expect(original.updatedAt).toBe(1500);
  });

  it("completing a recurring reminder past `until` spawns no row (bounded termination)", async () => {
    const db = makeFakeDb();
    const dueAt = day(2026, 3, 10);
    const until = day(2026, 3, 11); // less than the daily+1 next occurrence
    const id = await createReminderHandler(
      { db },
      {
        profileId: "personal",
        title: "Bounded",
        dueAt,
        source: "dashboard",
        recurrence: { freq: "weekly", interval: 1, until },
      },
      500
    );
    await completeReminderHandler({ db }, id, 1500);
    expect(db.rows.size).toBe(1);
  });

  it("snooze sets status snoozed and snoozedUntil", async () => {
    const db = makeFakeDb();
    const id = await createReminderHandler(
      { db },
      { profileId: "personal", title: "Snoozeme", source: "dashboard" },
      1000
    );
    await snoozeReminderHandler({ db }, id, 5000, 2000);
    const row = await db.get(id);
    expect(row.status).toBe("snoozed");
    expect(row.snoozedUntil).toBe(5000);
    expect(row.updatedAt).toBe(2000);
  });

  it("snooze clears notifiedAt so an already-nudged reminder is re-nudged at wake-up (CR-01)", async () => {
    const db = makeFakeDb();
    const id = await createReminderHandler(
      { db },
      { profileId: "personal", title: "Nudged then snoozed", dueAt: 1000, source: "dashboard" },
      500
    );
    // The Ástríðr nudge cron already alerted on this occurrence (REM-05).
    await db.patch(id, { notifiedAt: 1100 });

    await snoozeReminderHandler({ db }, id, 9000, 1200);

    const row = await db.get(id);
    expect(row.status).toBe("snoozed");
    expect(row.snoozedUntil).toBe(9000);
    // The dedupe stamp must be gone — the wake-up is a new occurrence and
    // must be eligible for exactly one new nudge (_is_due checks notifiedAt
    // BEFORE the snooze branch, so a surviving stamp silences it forever).
    expect(row.notifiedAt).toBeUndefined();
  });

  it("remove deletes the row", async () => {
    const db = makeFakeDb();
    const id = await createReminderHandler(
      { db },
      { profileId: "personal", title: "Delete me", source: "dashboard" },
      1000
    );
    await removeReminderHandler({ db }, id);
    expect(await db.get(id)).toBeNull();
  });

  it("dueSoon excludes status done and rows outside the window", async () => {
    const db = makeFakeDb();
    const now = 1000;
    const openInWindow = await createReminderHandler(
      { db },
      { profileId: "personal", title: "In window", dueAt: 1200, source: "dashboard" },
      now
    );
    await createReminderHandler(
      { db },
      { profileId: "personal", title: "Out of window", dueAt: 5000, source: "dashboard" },
      now
    );
    const doneInWindow = await createReminderHandler(
      { db },
      { profileId: "personal", title: "Done", dueAt: 1200, source: "dashboard" },
      now
    );
    await db.patch(doneInWindow, { status: "done" });

    const rows = await dueSoonHandler({ db }, 500, now); // cutoff = 1500
    expect(rows).toHaveLength(1);
    expect(rows[0]._id).toBe(openInWindow);
  });

  it("overdue excludes status done and never returns future rows", async () => {
    const db = makeFakeDb();
    const now = 2000;
    const overdueOpen = await createReminderHandler(
      { db },
      { profileId: "personal", title: "Overdue", dueAt: 1000, source: "dashboard" },
      now
    );
    await createReminderHandler(
      { db },
      { profileId: "personal", title: "Future", dueAt: 3000, source: "dashboard" },
      now
    );
    const overdueDone = await createReminderHandler(
      { db },
      { profileId: "personal", title: "Overdue but done", dueAt: 1000, source: "dashboard" },
      now
    );
    await db.patch(overdueDone, { status: "done" });

    const rows = await overdueHandler({ db }, now);
    expect(rows).toHaveLength(1);
    expect(rows[0]._id).toBe(overdueOpen);
  });
});

// ---------------------------------------------------------------------------
// markNotified (Phase 101 gap closure, REM-05)
//
// The nudge cron (plan 101-05) must record that it already alerted on an
// occurrence so it never nudges the same one twice. `notifiedAt` shipped in
// the schema in plan 101-01 but nothing could write it.
// ---------------------------------------------------------------------------

describe("markNotifiedHandler (REM-05 nudge dedupe)", () => {
  it("stamps notifiedAt on the row and bumps updatedAt", async () => {
    const db = makeFakeDb();
    const id = await db.insert("reminders", {
      profileId: "personal",
      title: "Water plants",
      status: "open",
      dueAt: 100,
      source: "dashboard",
      createdAt: 1,
      updatedAt: 1,
    });

    await markNotifiedHandler({ db }, id, 555, 999);

    const row = db.rows.get(id);
    expect(row.notifiedAt).toBe(555);
    expect(row.updatedAt).toBe(999);
    // It must not otherwise disturb the reminder.
    expect(row.status).toBe("open");
    expect(row.dueAt).toBe(100);
  });

  it("defaults notifiedAt to now when no explicit timestamp is given", async () => {
    const db = makeFakeDb();
    const id = await db.insert("reminders", {
      profileId: "business",
      title: "Send invoice",
      status: "open",
      dueAt: 100,
      source: "astridr",
      createdAt: 1,
      updatedAt: 1,
    });

    await markNotifiedHandler({ db }, id, undefined, 777);

    expect(db.rows.get(id).notifiedAt).toBe(777);
  });
});
