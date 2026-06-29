import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import KGDetailsPanel from "./KGDetailsPanel";
import { toGraphData, type KgPayload } from "../../lib/kg-graph";
import type { KgEntity, KgTriple } from "../../lib/kgApi";

const ent = (id: string, type = "person"): KgEntity => ({
  id,
  name: id.toUpperCase(),
  entityType: type,
  agentId: "",
});

const triple = (o: Partial<KgTriple>): KgTriple => ({
  id: o.id ?? "t1",
  subjectId: "a",
  predicate: "knows",
  objectId: "b",
  objectLiteral: null,
  validFrom: "2024-01-01T00:00:00Z",
  validTo: null,
  confidence: 0.8,
  agentId: "",
  contradictionFlag: false,
  sourceEventId: null,
  ...o,
});

function build(entities: KgEntity[], triples: KgTriple[]) {
  return toGraphData({ entities, triples } as KgPayload);
}

function renderPanel(
  graph: ReturnType<typeof build>,
  sel: { node?: string; edge?: string },
) {
  return render(
    <MemoryRouter>
      <KGDetailsPanel
        graph={graph}
        selectedNodeId={sel.node ?? null}
        selectedEdgeId={sel.edge ?? null}
        onClose={() => {}}
        onSelectNode={() => {}}
      />
    </MemoryRouter>,
  );
}

describe("KGDetailsPanel", () => {
  it("prompts to select when nothing is selected", () => {
    const g = build([ent("a")], []);
    renderPanel(g, {});
    expect(screen.getByText(/select an entity or edge/i)).toBeTruthy();
  });

  it("renders an entity with a literal attribute (NOT an edge)", () => {
    const g = build(
      [ent("a")],
      [
        triple({
          id: "lit",
          subjectId: "a",
          objectId: null,
          objectLiteral: "2024",
          predicate: "started_on",
        }),
      ],
    );
    renderPanel(g, { node: "a" });
    expect(screen.getByText(/Attributes \(1\)/)).toBeTruthy();
    expect(screen.getByText("started_on")).toBeTruthy();
    expect(screen.getByText("2024")).toBeTruthy();
  });

  it("lists an entity's outgoing relationships with the target name", () => {
    const g = build([ent("a"), ent("b")], [triple({ subjectId: "a", objectId: "b", predicate: "works_at" })]);
    renderPanel(g, { node: "a" });
    expect(screen.getByText(/Relationships \(1\)/)).toBeTruthy();
    expect(screen.getByText("works_at")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();
  });

  it("links provenance to the Memory view when sourceEventId is present", () => {
    const g = build(
      [ent("a"), ent("b")],
      [triple({ subjectId: "a", objectId: "b", sourceEventId: "evt-123" })],
    );
    renderPanel(g, { edge: "t1" });
    const link = screen.getByRole("link", { name: /memory/i }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/memory?event=evt-123");
  });

  it("shows 'no provenance' when sourceEventId is absent", () => {
    const g = build([ent("a"), ent("b")], [triple({ sourceEventId: null })]);
    renderPanel(g, { edge: "t1" });
    expect(screen.getByText(/no provenance/i)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /memory/i })).toBeNull();
  });

  it("renders edge details and flags a contradiction", () => {
    const g = build(
      [ent("a"), ent("b")],
      [triple({ contradictionFlag: true, confidence: 0.42 })],
    );
    renderPanel(g, { edge: "t1" });
    expect(screen.getByText(/Flagged contradiction/i)).toBeTruthy();
    expect(screen.getByText("42%")).toBeTruthy();
  });

  it("marks a superseded edge as current=false in the relationships list", () => {
    const g = build(
      [ent("a"), ent("b")],
      [triple({ validTo: "2025-01-01T00:00:00Z" })],
    );
    renderPanel(g, { node: "a" });
    const rels = screen.getByText(/Relationships \(1\)/).parentElement!;
    expect(within(rels).getByText(/superseded/i)).toBeTruthy();
  });

  it("renders an owning-agent reverse cross-graph link and calls onAgentNav on click", () => {
    const onAgentNav = vi.fn();
    const g = build([{ ...ent("a"), agentId: "hervor" }], []);
    render(
      <MemoryRouter>
        <KGDetailsPanel
          graph={g}
          selectedNodeId="a"
          selectedEdgeId={null}
          onClose={() => {}}
          onSelectNode={() => {}}
          onAgentNav={onAgentNav}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("RELATED ACROSS GRAPHS")).toBeTruthy();
    const btn = screen.getByText("hervor").closest("button")!;
    fireEvent.click(btn);
    // entity name is id.toUpperCase() === "A"
    expect(onAgentNav).toHaveBeenCalledWith("hervor", "A");
  });

  it("omits the owning-agent link when the entity has no agentId", () => {
    const g = build([ent("a")], []); // ent() default agentId ""
    render(
      <MemoryRouter>
        <KGDetailsPanel
          graph={g}
          selectedNodeId="a"
          selectedEdgeId={null}
          onClose={() => {}}
          onSelectNode={() => {}}
          onAgentNav={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByText("RELATED ACROSS GRAPHS")).toBeNull();
  });
});
