/**
 * Memory page — ?event= deep-link focus (cross-nav target for KGDetailsPanel
 * provenance links, "Open the episodic memory that taught this fact").
 *
 * Behavior under test: navigating to /memory?event=<id> highlights and scrolls
 * to the matching episodic event in the timeline.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── Mocks (declared before component import) ────────────────────────────────

const TIMELINE = [
  { _id: "evt-1", eventType: "observation", agentId: "skuld", summary: "First memory", detail: null, timestamp: 1700000000 },
  { _id: "evt-2", eventType: "learning", agentId: "hervor", summary: "Second memory", detail: null, timestamp: 1700000100 },
];

vi.mock("convex/react", () => ({
  useQuery: (ref: unknown) => {
    if (ref === "memory:timeline") return TIMELINE;
    if (ref === "memory:overview")
      return { total: 2, byType: { observation: 1, learning: 1 }, byAgent: { skuld: 1, hervor: 1 } };
    return undefined;
  },
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    memory: { overview: "memory:overview", timeline: "memory:timeline", search: "memory:search" },
    memoryTiers: { overview: "memoryTiers:overview", recent: "memoryTiers:recent" },
    reflections: { overview: "reflections:overview", recent: "reflections:recent" },
    memoryQuality: { getLatestQuality: "memoryQuality:getLatestQuality" },
    memoryPreflight: { recent: "memoryPreflight:recent", stats: "memoryPreflight:stats" },
    dreaming: { recentFacts: "dreaming:recentFacts" },
    conversationImports: { recent: "conversationImports:recent" },
  },
}));

// Mount-time vault effect + canvas children — stub so jsdom doesn't touch idb/canvas.
vi.mock("../lib/obsidian", () => ({
  getStoredVaultDirectory: () => Promise.resolve(null),
  requestVaultDirectory: () => Promise.resolve(null),
  parseVault: () => Promise.resolve(null),
}));
vi.mock("../components/MemoryIndexHealth", () => ({ default: () => null }));
vi.mock("../components/ObsidianGraph", () => ({ ObsidianGraph: () => null }));

import Memory from "./Memory";

beforeEach(() => {
  // jsdom doesn't implement scrollIntoView — stub it so the focus effect is safe.
  Element.prototype.scrollIntoView = vi.fn();
});

describe("Memory page — ?event= deep-link focus", () => {
  it("highlights the event named in ?event= and scrolls to it", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/memory?event=evt-2"]}>
        <Memory />
      </MemoryRouter>,
    );
    const focused = container.querySelector('[data-event-id="evt-2"]');
    const other = container.querySelector('[data-event-id="evt-1"]');
    expect(focused?.getAttribute("data-focused")).toBe("true");
    expect(other?.getAttribute("data-focused")).toBeNull();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("highlights no event when ?event= is absent", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/memory"]}>
        <Memory />
      </MemoryRouter>,
    );
    expect(container.querySelector('[data-focused="true"]')).toBeNull();
  });
});
