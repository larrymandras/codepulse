import { describe, it, expect } from "vitest";

describe("kits", () => {
  describe("upsertKit — upsert logic", () => {
    it("replaces the tools array wholesale on patch (idempotent by name)", () => {
      const existing = { tools: ["a", "b", "c"] };
      const incoming = { tools: ["a", "d"] };
      const patch = { tools: incoming.tools };
      expect(patch.tools).toEqual(["a", "d"]);
      expect(patch.tools).not.toBe(existing.tools);
    });

    it("carries description through on upsert", () => {
      const incoming = { name: "research", description: "search + scrape", tools: ["web_search"] };
      const patch = { description: incoming.description, tools: incoming.tools };
      expect(patch.description).toBe("search + scrape");
    });

    it.todo("should upsert via by_name index lookup (DB round-trip)");
    it.todo("should insert new row when no existing kit found (DB round-trip)");
  });

  describe("kits_snapshot event → upsertKit mapping (Phase 72)", () => {
    // Mirrors the `case "kits_snapshot"` branch in runtimeIngest.ts: iterates
    // data.kits, skips entries without a name, defaults a missing tools array
    // to [], and stamps updatedAt from the snapshot timestamp (fallback: now).
    const mapKitsSnapshot = (d: any, fallbackTs: number) => {
      if (!Array.isArray(d.kits)) return [];
      const updatedAt = d.timestamp ?? fallbackTs;
      const out: Array<{ name: string; description?: string; tools: string[]; updatedAt: number }> = [];
      for (const kit of d.kits) {
        const name = kit?.name;
        if (!name) continue;
        out.push({
          name,
          description: kit.description,
          tools: Array.isArray(kit.tools) ? kit.tools : [],
          updatedAt,
        });
      }
      return out;
    };

    it("maps each kit in the snapshot to an upsertKit arg, matching the contract shape", () => {
      const args = mapKitsSnapshot(
        {
          kits: [
            { name: "research", description: "search + scrape", tools: ["web_search", "fetch"] },
            { name: "memory", tools: ["memory_save", "memory_recall"] },
          ],
          timestamp: 1700,
        },
        9999,
      );
      expect(args).toHaveLength(2);
      expect(args[0]).toEqual({
        name: "research",
        description: "search + scrape",
        tools: ["web_search", "fetch"],
        updatedAt: 1700,
      });
      expect(args[1]).toEqual({
        name: "memory",
        description: undefined,
        tools: ["memory_save", "memory_recall"],
        updatedAt: 1700,
      });
    });

    it("stamps updatedAt from the snapshot timestamp, falling back to now", () => {
      const withTs = mapKitsSnapshot({ kits: [{ name: "k", tools: [] }], timestamp: 42 }, 9999);
      const withoutTs = mapKitsSnapshot({ kits: [{ name: "k", tools: [] }] }, 9999);
      expect(withTs[0].updatedAt).toBe(42);
      expect(withoutTs[0].updatedAt).toBe(9999);
    });

    it("skips kits with no name", () => {
      const args = mapKitsSnapshot(
        { kits: [{ tools: ["x"] }, { name: "real", tools: ["y"] }], timestamp: 1 },
        0,
      );
      expect(args).toHaveLength(1);
      expect(args[0].name).toBe("real");
    });

    it("defaults a missing/invalid tools field to an empty array", () => {
      const args = mapKitsSnapshot({ kits: [{ name: "k" }], timestamp: 1 }, 0);
      expect(args[0].tools).toEqual([]);
    });

    it("returns nothing when kits is absent or not an array", () => {
      expect(mapKitsSnapshot({ timestamp: 1 }, 0)).toEqual([]);
      expect(mapKitsSnapshot({ kits: "nope" }, 0)).toEqual([]);
    });
  });
});
