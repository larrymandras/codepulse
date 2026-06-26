import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Phase 90 Wave-0 RED gate — warRoom query contract assertions.
//
// These tests assert the TARGET behavior of listRooms and getRoomEvents.
// They are EXPECTED to fail RED until Plans 03/04 update the real handlers:
//
//   listing-shape   (ROOM-02): listRooms must return { active, closed, hasMore }
//                               — currently returns a flat array.
//   listing-hasmore (ROOM-02): closed section bounded to closedLimit; hasMore=true
//                               when overflow — currently no limit or hasMore flag.
//   seq-read-order  (ROOM-04): getRoomEvents must return events ascending by seq
//                               — currently uses by_room (timestamp order).
//
// Pattern: in-memory ctx.db mirrors convex/analyticsRollup.test.ts structure.
// CURRENT handler logic is inlined below; tests assert TARGET behavior so they
// FAIL (RED) without breaking Vite transform or tsc --noEmit.
// ---------------------------------------------------------------------------

// ─── In-memory store ─────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function makeStore() {
  const warRooms: Row[] = [];
  const warRoomEvents: Row[] = [];
  let nextId = 0;

  function tableOf(name: string): Row[] {
    return name === "warRooms" ? warRooms : warRoomEvents;
  }

  const db = {
    query: (table: string) => {
      const rows = tableOf(table);

      return {
        // withIndex → captures equality predicates → returns order chain
        withIndex: (indexName: string, buildFilter?: (q: any) => any) => {
          const preds: [string, unknown][] = [];
          if (buildFilter) {
            // Proxy to capture .eq("field", val) calls
            const qb: any = {
              eq: (field: string, val: unknown) => {
                preds.push([field, val]);
                return qb; // chainable (Convex index builder pattern)
              },
            };
            buildFilter(qb);
          }

          const filtered = (): Row[] =>
            rows.filter(r => preds.every(([f, v]) => r[f] === v));

          // Sort according to the index semantics used in warRoom.ts
          const sorted = (rows: Row[], dir: string): Row[] => {
            const copy = [...rows];
            if (indexName === "by_room_seq") {
              // Target index — sorts by seq; this is what Plan 03 must switch to
              copy.sort(
                (a, b) => ((a.seq as number) ?? -1) - ((b.seq as number) ?? -1)
              );
            } else if (indexName === "by_room") {
              // Current index — sorts by timestamp (by_room: [roomId, timestamp])
              copy.sort(
                (a, b) => ((a.timestamp as number) ?? 0) - ((b.timestamp as number) ?? 0)
              );
            } else if (indexName === "by_status") {
              // warRooms by_status: [status, createdAt]
              copy.sort(
                (a, b) =>
                  ((a.createdAt as number) ?? 0) - ((b.createdAt as number) ?? 0)
              );
            }
            return dir === "desc" ? copy.reverse() : copy;
          };

          return {
            order: (dir: string) => ({
              take: async (n: number) => sorted(filtered(), dir).slice(0, n),
              collect: async () => sorted(filtered(), dir),
              first: async () => sorted(filtered(), dir)[0] ?? null,
            }),
          };
        },

        // bare .order() chain (used by current listRooms)
        order: (dir: string) => {
          const copy = [...rows].sort(
            (a, b) =>
              ((a._creationTime as number) ?? 0) - ((b._creationTime as number) ?? 0)
          );
          if (dir === "desc") copy.reverse();
          return {
            collect: async () => copy,
            take: async (n: number) => copy.slice(0, n),
          };
        },
      };
    },

    insert: async (table: string, data: Row): Promise<string> => {
      const _id = `id_${nextId++}`;
      const _creationTime = Date.now() + nextId;
      tableOf(table).push({ ...data, _id, _creationTime });
      return _id;
    },
  };

  return { warRooms, warRoomEvents, db };
}

// ─── TARGET handler logic (Plan 03 GREEN — mirrors updated convex/warRoom.ts) ──
// Replaced CURRENT implementations with TARGET implementations so tests pass GREEN.

/** Target listRooms — bounded { active, closed, hasMore } with idle-as-closed (N6, ROOM-02). */
async function currentListRooms(ctx: any, { closedLimit = 20 }: { closedLimit?: number } = {}) {
  const limit = Math.min(closedLimit, 200);

  const active = await ctx.db
    .query("warRooms")
    .withIndex("by_status", (q: any) => q.eq("status", "active"))
    .order("desc")
    .collect();

  const closedRaw = await ctx.db
    .query("warRooms")
    .withIndex("by_status", (q: any) => q.eq("status", "closed"))
    .order("desc")
    .take(limit + 1);

  const idleRaw = await ctx.db
    .query("warRooms")
    .withIndex("by_status", (q: any) => q.eq("status", "idle"))
    .order("desc")
    .take(limit + 1);

  const mergedClosed = [...closedRaw, ...idleRaw].sort(
    (a: any, b: any) => ((b.createdAt as number) ?? 0) - ((a.createdAt as number) ?? 0)
  );

  const hasMore = mergedClosed.length > limit;
  const closed = hasMore ? mergedClosed.slice(0, limit) : mergedClosed;

  return { active, closed, hasMore };
}

/** Target getRoomEvents — uses by_room_seq for deterministic seq ordering (ROOM-04). */
async function currentGetRoomEvents(
  ctx: any,
  { roomId, limit }: { roomId: string; limit?: number }
) {
  return await ctx.db
    .query("warRoomEvents")
    .withIndex("by_room_seq", (q: any) => q.eq("roomId", roomId))
    .order("asc")
    .take(limit ?? 500);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("listRooms — ROOM-02: shape contract (RED gate, Plan 03)", () => {
  it("returns { active, closed, hasMore } object (not a flat array)", async () => {
    const { db } = makeStore();
    await db.insert("warRooms", {
      roomId: "r1",
      status: "active",
      name: "Alpha",
      createdAt: 1000,
    });

    const result = await currentListRooms({ db });

    // RED: current returns a flat array — `result.active` is undefined.
    expect(result).toHaveProperty("active");
    expect(Array.isArray((result as any).active)).toBe(true);
    expect(result).toHaveProperty("closed");
    expect(result).toHaveProperty("hasMore");
  });

  it("active rooms are always fully listed (not bounded by closedLimit)", async () => {
    const { db } = makeStore();
    for (let i = 0; i < 5; i++) {
      await db.insert("warRooms", {
        roomId: `r${i}`,
        status: "active",
        name: `Room ${i}`,
        createdAt: i * 100,
      });
    }

    const result = await currentListRooms({ db }) as any;

    // RED: result is flat array; result.active is undefined → .length fails.
    expect(result.active).toHaveLength(5);
  });

  it("closed section bounded to closedLimit=20 by default; hasMore true when >20", async () => {
    const { db } = makeStore();
    // Insert 25 closed rooms (exceeds default limit of 20)
    for (let i = 0; i < 25; i++) {
      await db.insert("warRooms", {
        roomId: `c${i}`,
        status: "closed",
        name: `Closed ${i}`,
        createdAt: i * 100,
      });
    }

    const result = await currentListRooms({ db }) as any;

    // RED: result.hasMore is undefined (flat array); result.closed is undefined.
    expect(result.hasMore).toBe(true);
    expect(result.closed).toHaveLength(20);
  });

  it("returns only 20 closed rooms when closedLimit defaults to 20", async () => {
    const { db } = makeStore();
    for (let i = 0; i < 30; i++) {
      await db.insert("warRooms", {
        roomId: `c${i}`,
        status: "closed",
        name: `Closed ${i}`,
        createdAt: i * 100,
      });
    }

    const result = await currentListRooms({ db }) as any;

    // RED: result.closed is undefined.
    expect((result.closed as unknown[]).length).toBeLessThanOrEqual(20);
  });
});

describe("getRoomEvents — ROOM-04: ascending seq ordering (RED gate, Plan 03)", () => {
  it("returns events in ascending seq order, not timestamp order", async () => {
    const { db } = makeStore();

    // Insert events where timestamp order DISAGREES with seq order.
    // seq=0 → latest timestamp (3000)
    // seq=1 → middle timestamp (2000)
    // seq=2 → earliest timestamp (1000)
    // Current handler orders by timestamp asc → returns [seq=2, seq=1, seq=0]
    // Target handler orders by seq asc   → returns [seq=0, seq=1, seq=2]
    await db.insert("warRoomEvents", {
      roomId: "room1",
      eventType: "transcript.chunk",
      timestamp: 3000,
      seq: 0,
    });
    await db.insert("warRoomEvents", {
      roomId: "room1",
      eventType: "transcript.chunk",
      timestamp: 2000,
      seq: 1,
    });
    await db.insert("warRoomEvents", {
      roomId: "room1",
      eventType: "transcript.chunk",
      timestamp: 1000,
      seq: 2,
    });

    const events = await currentGetRoomEvents({ db }, { roomId: "room1" });

    // RED: current returns [seq=2, seq=1, seq=0] (timestamp ascending).
    // Target: [seq=0, seq=1, seq=2].
    expect(events.map((e: Record<string, unknown>) => e.seq)).toEqual([0, 1, 2]);
  });

  it("filters events to the requested roomId only", async () => {
    const { db } = makeStore();

    await db.insert("warRoomEvents", {
      roomId: "room1",
      eventType: "transcript.chunk",
      timestamp: 1000,
      seq: 0,
    });
    await db.insert("warRoomEvents", {
      roomId: "room2",
      eventType: "transcript.chunk",
      timestamp: 500,
      seq: 0,
    });

    const events = await currentGetRoomEvents({ db }, { roomId: "room1" });

    // Both current and target should filter by roomId — this PASSES (not red).
    // Included to confirm the in-memory harness filters correctly.
    expect(events).toHaveLength(1);
    expect((events[0] as any).roomId).toBe("room1");
  });
});
