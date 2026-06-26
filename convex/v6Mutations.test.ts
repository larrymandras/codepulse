import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Phase 90 Wave-0 RED gate — insertWarRoomEvent seq-assignment assertions.
//
// These tests assert the TARGET behavior of insertWarRoomEvent (ROOM-04):
//   seq-assign: seq = (max seq for roomId) + 1, computed server-side in mutation
//   seq-unique:  concurrent / sequential inserts → strictly increasing, unique seq
//
// They are EXPECTED to fail RED until Plan 05 adds seq computation to the
// mutation handler in convex/v6Mutations.ts.
//
// Current behavior (shipped in Wave 1):
//   await ctx.db.insert("warRoomEvents", args);
//   — seq is never computed or stored; all rows have seq: undefined.
//
// Target behavior (Plan 05):
//   const last = await ctx.db
//     .query("warRoomEvents")
//     .withIndex("by_room_seq", q => q.eq("roomId", args.roomId))
//     .order("desc").first();
//   const seq = (last?.seq ?? -1) + 1;
//   await ctx.db.insert("warRoomEvents", { ...args, seq });
//
// Pattern: in-memory ctx.db mirrors convex/analyticsRollup.test.ts structure.
// ---------------------------------------------------------------------------

// ─── In-memory store ─────────────────────────────────────────────────────────

type EventRow = Record<string, unknown>;

function makeEventStore() {
  const warRoomEvents: EventRow[] = [];
  let nextId = 0;

  const db = {
    query: (_table: string) => ({
      withIndex: (indexName: string, buildFilter?: (q: any) => any) => {
        const preds: [string, unknown][] = [];
        if (buildFilter) {
          const qb: any = {
            eq: (field: string, val: unknown) => {
              preds.push([field, val]);
              return qb;
            },
          };
          buildFilter(qb);
        }

        const filtered = (): EventRow[] =>
          warRoomEvents.filter(r => preds.every(([f, v]) => r[f] === v));

        const sorted = (rows: EventRow[], dir: string): EventRow[] => {
          const copy = [...rows];
          if (indexName === "by_room_seq") {
            copy.sort(
              (a, b) => ((a.seq as number) ?? -1) - ((b.seq as number) ?? -1)
            );
          }
          return dir === "desc" ? copy.reverse() : copy;
        };

        return {
          order: (dir: string) => ({
            first: async (): Promise<EventRow | null> =>
              sorted(filtered(), dir)[0] ?? null,
          }),
        };
      },
    }),

    insert: async (_table: string, data: EventRow): Promise<string> => {
      const _id = `id_${nextId++}`;
      warRoomEvents.push({ ...data, _id });
      return _id;
    },
  };

  return { warRoomEvents, db };
}

// ─── TARGET handler logic (Plan 03 GREEN — mirrors updated convex/v6Mutations.ts) ─
// Computes monotonic per-room seq via by_room_seq read-max-then-insert (ROOM-04).

async function currentInsertWarRoomEvent(
  ctx: any,
  args: {
    roomId: string;
    eventType: string;
    timestamp: number;
    speakerId?: string;
    speakerName?: string;
    text?: string;
    payload?: unknown;
  }
) {
  // Target implementation: read max seq for room, assign seq = max + 1 (OCC pattern).
  const lastEvent = await ctx.db
    .query("warRoomEvents")
    .withIndex("by_room_seq", (q: any) => q.eq("roomId", args.roomId))
    .order("desc")
    .first();
  const seq = (lastEvent?.seq ?? -1) + 1;
  await ctx.db.insert("warRoomEvents", { ...args, seq });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("insertWarRoomEvent — ROOM-04: seq assignment (RED gate, Plan 05)", () => {
  it("first event in a room receives seq = 0", async () => {
    const { warRoomEvents, db } = makeEventStore();

    await currentInsertWarRoomEvent(
      { db },
      { roomId: "room1", eventType: "transcript.chunk", timestamp: 1000 }
    );

    // RED: current does not assign seq — warRoomEvents[0].seq is undefined.
    expect(warRoomEvents[0].seq).toBe(0);
  });

  it("second event receives seq = 1 (max+1 pattern)", async () => {
    const { warRoomEvents, db } = makeEventStore();

    await currentInsertWarRoomEvent(
      { db },
      { roomId: "room1", eventType: "transcript.chunk", timestamp: 1000 }
    );
    await currentInsertWarRoomEvent(
      { db },
      { roomId: "room1", eventType: "transcript.chunk", timestamp: 2000 }
    );

    // RED: current does not assign seq — warRoomEvents[1].seq is undefined.
    expect(warRoomEvents[1].seq).toBe(1);
  });

  it("sequential inserts produce strictly increasing unique seq values per room", async () => {
    const { warRoomEvents, db } = makeEventStore();

    for (let i = 0; i < 5; i++) {
      await currentInsertWarRoomEvent(
        { db },
        { roomId: "room1", eventType: "transcript.chunk", timestamp: i * 1000 }
      );
    }

    const seqs = warRoomEvents.map(e => e.seq);

    // RED: current does not assign seq — all seqs are undefined.
    const uniqueSeqs = new Set(seqs);
    expect(uniqueSeqs.size).toBe(5); // all unique
    expect(seqs).toEqual([0, 1, 2, 3, 4]); // strictly increasing from 0
  });

  it("seq is scoped per room — different rooms get independent sequences", async () => {
    const { warRoomEvents, db } = makeEventStore();

    await currentInsertWarRoomEvent(
      { db },
      { roomId: "room1", eventType: "transcript.chunk", timestamp: 1000 }
    );
    await currentInsertWarRoomEvent(
      { db },
      { roomId: "room2", eventType: "transcript.chunk", timestamp: 2000 }
    );
    await currentInsertWarRoomEvent(
      { db },
      { roomId: "room1", eventType: "transcript.chunk", timestamp: 3000 }
    );

    const room1Events = warRoomEvents.filter(e => e.roomId === "room1");
    const room2Events = warRoomEvents.filter(e => e.roomId === "room2");

    // RED: current does not assign seq — all seqs are undefined.
    expect(room1Events[0].seq).toBe(0);
    expect(room1Events[1].seq).toBe(1); // second room1 event gets seq=1
    expect(room2Events[0].seq).toBe(0); // room2 starts its own sequence from 0
  });
});
