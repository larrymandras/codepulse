import { describe, it, expect } from "vitest";
import {
  toGraphData,
  deriveView,
  normalizeOverview,
  normalizeEntity,
  normalizeContradictions,
  normalizeEntityType,
  entityTypeColor,
  confidenceToWidth,
  getNeighbors,
  computeFocusSet,
  derivePredicates,
  deriveEntityTypes,
  ENTITY_TYPE_COLORS,
  COMMUNITY_PALETTE,
  communityColor,
  type KgPayload,
} from "./kg-graph";
import type {
  KgTriple,
  KgEntity,
  KgOverviewResponse,
  KgEntityResponse,
  KgContradictionsResponse,
} from "./kgApi";

// ── builders ──────────────────────────────────────────────────────────────

const ent = (id: string, type = "person", extra: Partial<KgEntity> = {}): KgEntity => ({
  id,
  name: id,
  entityType: type,
  agentId: "",
  ...extra,
});

const triple = (over: Partial<KgTriple> = {}): KgTriple => ({
  id: over.id ?? `t-${Math.random().toString(36).slice(2)}`,
  subjectId: "a",
  predicate: "knows",
  objectId: "b",
  objectLiteral: null,
  validFrom: "2024-01-01T00:00:00Z",
  validTo: null,
  confidence: 0.8,
  agentId: "",
  contradictionFlag: false,
  ...over,
});

const payload = (
  entities: KgEntity[],
  triples: KgTriple[],
): KgPayload => ({ entities, triples });

// ── entityTypeColors stability ──────────────────────────────────────────────

describe("entity type colors", () => {
  it("exposes a stable 10-type color map", () => {
    expect(ENTITY_TYPE_COLORS).toHaveLength(10);
    // stable: person is always emerald
    expect(entityTypeColor("person")).toBe("#10b981");
    expect(entityTypeColor("PERSON")).toBe("#10b981");
  });

  it("normalizes synonyms and unknowns to canonical buckets", () => {
    expect(normalizeEntityType("company")).toBe("organization");
    expect(normalizeEntityType("city")).toBe("place");
    expect(normalizeEntityType("")).toBe("other");
    expect(normalizeEntityType("zzz-unknown")).toBe("other");
    expect(entityTypeColor("zzz-unknown")).toBe("#94a3b8"); // other/slate
  });
});

// ── node color by type ──────────────────────────────────────────────────────

describe("toGraphData — node coloring & sizing", () => {
  it("colors nodes by their entity type", () => {
    const g = toGraphData(
      payload([ent("a", "person"), ent("b", "organization")], [triple()]),
    );
    const a = g.nodes.find((n) => n.id === "a")!;
    const b = g.nodes.find((n) => n.id === "b")!;
    expect(a.color).toBe("#10b981");
    expect(b.color).toBe("#3b82f6");
  });

  it("sizes nodes by degree (hub larger than leaf)", () => {
    const g = toGraphData(
      payload(
        [ent("hub"), ent("x"), ent("y")],
        [
          triple({ subjectId: "hub", objectId: "x" }),
          triple({ subjectId: "hub", objectId: "y" }),
        ],
      ),
    );
    const hub = g.nodes.find((n) => n.id === "hub")!;
    const leaf = g.nodes.find((n) => n.id === "x")!;
    expect(hub.degree).toBe(2);
    expect(leaf.degree).toBe(1);
    expect(hub.val).toBeGreaterThan(leaf.val);
  });
});

// ── entity edge vs literal attribute ────────────────────────────────────────

describe("toGraphData — entity edge vs literal attribute", () => {
  it("creates a directed edge for an entity→entity triple", () => {
    const g = toGraphData(payload([ent("a"), ent("b")], [triple({ id: "e1" })]));
    expect(g.links).toHaveLength(1);
    expect(g.links[0]).toMatchObject({
      id: "e1",
      source: "a",
      target: "b",
      predicate: "knows",
    });
    expect(g.stats.attributeCount).toBe(0);
  });

  it("renders a literal-object triple as a node attribute, NOT an edge", () => {
    const g = toGraphData(
      payload(
        [ent("a")],
        [
          triple({
            id: "lit1",
            subjectId: "a",
            objectId: null,
            objectLiteral: "2024",
            predicate: "started_on",
          }),
        ],
      ),
    );
    expect(g.links).toHaveLength(0);
    const a = g.nodes.find((n) => n.id === "a")!;
    expect(a.attributes).toHaveLength(1);
    expect(a.attributes[0]).toMatchObject({
      predicate: "started_on",
      value: "2024",
      sourceTripleId: "lit1",
    });
    expect(g.stats.attributeCount).toBe(1);
  });

  it("synthesizes neighbor nodes referenced only by triples", () => {
    const g = toGraphData(payload([ent("a")], [triple({ subjectId: "a", objectId: "ghost" })]));
    const ghost = g.nodes.find((n) => n.id === "ghost")!;
    expect(ghost).toBeTruthy();
    expect(ghost.synthetic).toBe(true);
  });
});

// ── confidence → width ──────────────────────────────────────────────────────

describe("confidence → edge width", () => {
  it("maps confidence 0..1 to width 1..6", () => {
    expect(confidenceToWidth(0)).toBeCloseTo(1);
    expect(confidenceToWidth(1)).toBeCloseTo(6);
    expect(confidenceToWidth(0.5)).toBeCloseTo(3.5);
  });
  it("uses a mid width when confidence is missing", () => {
    expect(confidenceToWidth(null)).toBeCloseTo(3.5);
  });
  it("higher-confidence edges are wider on the built graph", () => {
    const g = toGraphData(
      payload(
        [ent("a"), ent("b"), ent("c")],
        [
          triple({ subjectId: "a", objectId: "b", confidence: 0.2 }),
          triple({ subjectId: "a", objectId: "c", confidence: 0.95 }),
        ],
      ),
    );
    const low = g.links.find((l) => l.target === "b")!;
    const high = g.links.find((l) => l.target === "c")!;
    expect(high.width).toBeGreaterThan(low.width);
  });
});

// ── current vs superseded vs contradiction ──────────────────────────────────

describe("toGraphData — temporal & contradiction edge state", () => {
  it("flags current (validTo null) vs superseded (validTo set)", () => {
    const g = toGraphData(
      payload(
        [ent("a"), ent("b"), ent("c")],
        [
          triple({ subjectId: "a", objectId: "b", validTo: null }),
          triple({
            subjectId: "a",
            objectId: "c",
            validTo: "2025-01-01T00:00:00Z",
          }),
        ],
      ),
    );
    const cur = g.links.find((l) => l.target === "b")!;
    const sup = g.links.find((l) => l.target === "c")!;
    expect(cur.current).toBe(true);
    expect(sup.current).toBe(false);
    expect(g.stats.currentEdges).toBe(1);
    expect(g.stats.supersededEdges).toBe(1);
  });

  it("propagates the contradiction flag", () => {
    const g = toGraphData(
      payload([ent("a"), ent("b")], [triple({ contradictionFlag: true })]),
    );
    expect(g.links[0].contradictionFlag).toBe(true);
    expect(g.stats.contradictionEdges).toBe(1);
  });
});

// ── normalizers ──────────────────────────────────────────────────────────────

describe("normalizeOverview", () => {
  it("flattens nested relationships and dedupes triples by id", () => {
    const resp: KgOverviewResponse = {
      entities: [
        {
          id: "a",
          name: "Alpha",
          entityType: "person",
          agentId: "",
          relationships: [triple({ id: "shared", subjectId: "a", objectId: "b" })],
        },
        {
          id: "b",
          name: "Beta",
          entityType: "organization",
          agentId: "",
          relationships: [
            triple({ id: "shared", subjectId: "a", objectId: "b" }), // dup
            triple({ id: "b-own", subjectId: "b", objectId: "a" }),
          ],
        },
      ],
      count: 2,
      total: 5,
      truncated: true,
      asOf: null,
    };
    const p = normalizeOverview(resp);
    expect(p.entities).toHaveLength(2);
    expect(p.triples.map((t) => t.id).sort()).toEqual(["b-own", "shared"]);
    expect(p.meta?.truncated).toBe(true);
    expect(p.meta?.total).toBe(5);
  });
});

describe("normalizeEntity", () => {
  it("keeps the focus entity and its flat triples", () => {
    const resp: KgEntityResponse = {
      entity: { id: "a", name: "Larry" },
      triples: [triple({ subjectId: "a", objectId: "b" })],
      hops: 1,
      asOf: null,
    };
    const p = normalizeEntity(resp);
    expect(p.entities[0].id).toBe("a");
    expect(p.triples).toHaveLength(1);
  });
  it("handles an unknown entity (null) gracefully", () => {
    const resp: KgEntityResponse = { entity: null, triples: [], hops: 1, asOf: null };
    const p = normalizeEntity(resp);
    expect(p.entities).toHaveLength(0);
    expect(p.triples).toHaveLength(0);
  });
});

describe("normalizeContradictions", () => {
  it("returns triples with synthesized endpoints", () => {
    const resp: KgContradictionsResponse = {
      contradictions: [triple({ subjectId: "a", objectId: "b", contradictionFlag: true })],
      count: 1,
    };
    const p = normalizeContradictions(resp);
    const g = toGraphData(p);
    expect(g.links[0].contradictionFlag).toBe(true);
    expect(g.nodes).toHaveLength(2);
    expect(g.nodes.every((n) => n.synthetic)).toBe(true);
  });
});

// ── deriveView ──────────────────────────────────────────────────────────────

describe("deriveView — client-side filters", () => {
  const baseGraph = () =>
    toGraphData(
      payload(
        [ent("a", "person"), ent("b", "organization"), ent("c", "project")],
        [
          triple({ id: "ab", subjectId: "a", objectId: "b", predicate: "works_at", agentId: "skuld" }),
          triple({ id: "ac", subjectId: "a", objectId: "c", predicate: "owns", agentId: "hildr" }),
        ],
      ),
    );

  it("returns the same graph when no filters set", () => {
    const g = baseGraph();
    expect(deriveView(g, {})).toBe(g);
  });

  it("filters by entity type and prunes dangling edges/nodes", () => {
    const g = deriveView(baseGraph(), { entityTypes: ["person", "organization"] });
    expect(g.nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
    expect(g.links.map((l) => l.id)).toEqual(["ab"]);
  });

  it("filters by predicate", () => {
    const g = deriveView(baseGraph(), { predicates: ["owns"] });
    expect(g.links.map((l) => l.id)).toEqual(["ac"]);
  });

  it("filters by agent", () => {
    const g = deriveView(baseGraph(), { agentId: "skuld" });
    expect(g.links.map((l) => l.id)).toEqual(["ab"]);
  });
});

// ── neighbors / focus ────────────────────────────────────────────────────────

describe("getNeighbors / computeFocusSet", () => {
  const g = () =>
    toGraphData(
      payload(
        [ent("a"), ent("b"), ent("c"), ent("d")],
        [
          triple({ subjectId: "a", objectId: "b" }),
          triple({ subjectId: "a", objectId: "c" }),
        ],
      ),
    );

  it("returns directly-connected nodes either direction", () => {
    const nb = getNeighbors(g(), "a");
    expect([...nb].sort()).toEqual(["b", "c"]);
    expect([...getNeighbors(g(), "b")]).toEqual(["a"]);
  });

  it("computeFocusSet includes the node + neighbors; null for no selection", () => {
    const fs = computeFocusSet(g(), "a")!;
    expect([...fs].sort()).toEqual(["a", "b", "c"]);
    expect(computeFocusSet(g(), null)).toBeNull();
  });
});

describe("derivePredicates / deriveEntityTypes", () => {
  it("lists distinct predicates and types sorted", () => {
    const g = toGraphData(
      payload(
        [ent("a", "person"), ent("b", "project")],
        [triple({ subjectId: "a", objectId: "b", predicate: "owns" })],
      ),
    );
    expect(derivePredicates(g)).toEqual(["owns"]);
    expect(deriveEntityTypes(g)).toEqual(["person", "project"]);
  });
});

// ── COMMUNITY_PALETTE + communityColor ──────────────────────────────────────

describe("COMMUNITY_PALETTE", () => {
  it("has exactly 8 entries", () => {
    expect(COMMUNITY_PALETTE).toHaveLength(8);
  });

  it("does not include the #10b981 emerald accent color", () => {
    expect(COMMUNITY_PALETTE).not.toContain("#10b981");
  });

  it("contains all 8 UI-SPEC locked hex values in exact slot order", () => {
    // Slots specified in 86-UI-SPEC.md § Color (locked values):
    const expected = [
      "#60a5fa", // 0 — blue-400
      "#f472b6", // 1 — pink-400
      "#fbbf24", // 2 — amber-400
      "#34d399", // 3 — emerald-400
      "#a78bfa", // 4 — violet-400
      "#22d3ee", // 5 — cyan-400
      "#fb923c", // 6 — orange-400
      "#a3e635", // 7 — lime-400
    ];
    expect(COMMUNITY_PALETTE).toEqual(expected);
  });

  it("slot 0 is #60a5fa (blue-400)", () => {
    expect(COMMUNITY_PALETTE[0]).toBe("#60a5fa");
  });

  it("slot 3 is #34d399 (emerald-400 — lighter than accent)", () => {
    expect(COMMUNITY_PALETTE[3]).toBe("#34d399");
  });
});

describe("communityColor", () => {
  it("returns null for null community", () => {
    expect(communityColor(null)).toBeNull();
  });

  it("returns null for undefined community", () => {
    expect(communityColor(undefined)).toBeNull();
  });

  it("returns slot 0 (#60a5fa) for community 0", () => {
    expect(communityColor(0)).toBe("#60a5fa");
  });

  it("returns slot 3 (#34d399) for community 3", () => {
    expect(communityColor(3)).toBe("#34d399");
  });

  it("wraps at 8: community 8 returns slot 0 (#60a5fa)", () => {
    expect(communityColor(8)).toBe("#60a5fa");
  });

  it("wraps at 8: community 9 returns slot 1", () => {
    expect(communityColor(9)).toBe(COMMUNITY_PALETTE[1]);
  });

  it("handles negative community via Math.abs: -1 returns slot 1", () => {
    const result = communityColor(-1);
    expect(result).toBe(COMMUNITY_PALETTE[1]);
    expect(result).not.toBeNull();
  });
});

// ── KgNode.community field threaded through toGraphData ──────────────────────

describe("KgNode.community field", () => {
  it("is null by default (no seed community)", () => {
    const g = toGraphData(payload([ent("a", "person")], []));
    const a = g.nodes.find((n) => n.id === "a")!;
    expect(a.community).toBeNull();
  });

  it("threads community value from the entity seed", () => {
    // Simulate a seed with a community field (as graphSnapshotNodes emit it)
    const entityWithCommunity = { ...ent("a", "person"), community: 2 } as any;
    const g = toGraphData({ entities: [entityWithCommunity], triples: [] });
    const a = g.nodes.find((n) => n.id === "a")!;
    expect(a.community).toBe(2);
  });
});
