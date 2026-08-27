/**
 * Loom.test.tsx — coverage for the Loom page (Phase 119).
 *
 * The second of the three gaps in
 * `.planning/milestones/v14.0-phases/119-loom-curated-pipelines/119-VALIDATION.md`.
 *
 * `@xyflow/react` is mocked per-file with the repo's `vi.hoisted` props-capture
 * pattern (see `ForceGraphCanvas.test.tsx` / `WorkspaceMapCanvas.test.tsx`) —
 * heavy render libraries are mocked per test file here, never globally in
 * `src/test/setup.ts`.
 *
 * Capturing ReactFlow's props is what makes the page's `buildGraph` testable at
 * all: it is module-private, and the node/edge shape it computes — each step's
 * state, which step is current, which edge animates — is the page's real logic.
 * Asserting on rendered text alone could not see any of it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useQuery } from "convex/react";
import Loom from "./Loom";

const h = vi.hoisted(() => ({
  props: null as Record<string, any> | null,
}));

vi.mock("@xyflow/react", () => ({
  ReactFlow: (props: Record<string, any>) => {
    h.props = props;
    // Render the node labels so click-through can be exercised without the
    // real canvas, and expose a hook for onNodeClick.
    return (
      <div data-testid="reactflow">
        {(props.nodes ?? []).map((n: any) => (
          <button
            key={n.id}
            type="button"
            data-testid={`node-${n.id}`}
            onClick={() => props.onNodeClick?.({}, n)}
          >
            {n.data?.label}
          </button>
        ))}
        {props.children}
      </div>
    );
  },
  Background: () => <div data-testid="rf-background" />,
  Controls: () => <div data-testid="rf-controls" />,
}));

vi.mock("@xyflow/react/dist/style.css", () => ({}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    loom: {
      listPipelines: "loom:listPipelines",
      listRuns: "loom:listRuns",
    },
  },
}));

const mockUseQuery = vi.mocked(useQuery);

beforeEach(() => {
  mockUseQuery.mockReset();
  h.props = null;
});

/** Route each query by its (mocked) function reference, so a test can set
 * pipelines and runs independently — including the loading (`undefined`) and
 * empty (`[]`) states separately for each. */
function wire({
  pipelines,
  runs = [],
}: {
  pipelines: any;
  runs?: any;
}) {
  // `useQuery` is overloaded (its second arg may be "skip"), so a
  // single-parameter implementation does not satisfy the mocked signature —
  // `npx tsc --noEmit`, which CI runs, rejects it. Take the full arg tuple.
  mockUseQuery.mockImplementation((...args: any[]) => {
    const ref = args[0];
    if (ref === "loom:listPipelines") return pipelines;
    if (ref === "loom:listRuns") return runs;
    return undefined;
  });
}

function pipeline(overrides: Partial<any> = {}) {
  return {
    _id: "p1",
    slug: "nightly-build",
    name: "Nightly Build",
    description: "Builds the thing every night",
    sourceRef: "hooks/nightly.mjs",
    steps: [
      { id: "fetch", name: "Fetch", docMd: "# Fetch\nPulls the source." },
      { id: "build", name: "Build" },
      { id: "ship", name: "Ship" },
    ],
    ...overrides,
  };
}

function run(overrides: Partial<any> = {}) {
  return {
    _id: "r1",
    pipelineSlug: "nightly-build",
    status: "running",
    startedAt: 1_700_000_000_000,
    currentStep: "build",
    stepEvents: [
      { stepId: "fetch", event: "complete", at: 1 },
      { stepId: "build", event: "start", at: 2 },
    ],
    ...overrides,
  };
}

// ============================================================
// Loading / empty / populated
// ============================================================

describe("Loom — loading vs empty are distinguished", () => {
  it("loading: renders skeletons and NOT the empty state", () => {
    wire({ pipelines: undefined });
    const { container } = render(<Loom />);

    expect(container.querySelector('[data-slot="skeleton"], .animate-pulse')).not.toBeNull();
    expect(screen.queryByText(/no pipelines yet/i)).toBeNull();
  });

  it("empty: renders the empty state and NOT skeletons", () => {
    wire({ pipelines: [] });
    render(<Loom />);

    expect(screen.getByText(/no pipelines yet/i)).toBeInTheDocument();
    expect(screen.getByText("/loom-author")).toBeInTheDocument();
  });

  it("populated: renders the pipeline's name, description and source ref", () => {
    wire({ pipelines: [pipeline()] });
    render(<Loom />);

    expect(screen.getByText("Nightly Build")).toBeInTheDocument();
    expect(screen.getByText("Builds the thing every night")).toBeInTheDocument();
    expect(screen.getByText("hooks/nightly.mjs")).toBeInTheDocument();
  });
});

// ============================================================
// buildGraph — the page's real logic, read off the captured props
// ============================================================

describe("Loom — graph construction", () => {
  it("emits one node per step, in order, laid out left to right", () => {
    wire({ pipelines: [pipeline()] });
    render(<Loom />);

    const nodes = h.props!.nodes;
    expect(nodes.map((n: any) => n.id)).toEqual(["fetch", "build", "ship"]);
    expect(nodes.map((n: any) => n.position.x)).toEqual([0, 220, 440]);
    expect(new Set(nodes.map((n: any) => n.type))).toEqual(new Set(["loomStep"]));
  });

  it("emits edges connecting consecutive steps only", () => {
    wire({ pipelines: [pipeline()] });
    render(<Loom />);

    const edges = h.props!.edges;
    expect(edges.map((e: any) => [e.source, e.target])).toEqual([
      ["fetch", "build"],
      ["build", "ship"],
    ]);
  });

  it("a single-step pipeline produces no edges", () => {
    wire({ pipelines: [pipeline({ steps: [{ id: "only", name: "Only" }] })] });
    render(<Loom />);
    expect(h.props!.edges).toEqual([]);
  });

  it("derives each node's state from the run's event trail", () => {
    wire({ pipelines: [pipeline()], runs: [run()] });
    render(<Loom />);

    const byId = Object.fromEntries(
      h.props!.nodes.map((n: any) => [n.id, n.data.state])
    );
    expect(byId).toEqual({
      fetch: "complete",
      build: "running",
      ship: "pending",
    });
  });

  it("shows every step pending when there is no run at all", () => {
    wire({ pipelines: [pipeline()], runs: [] });
    render(<Loom />);

    expect(h.props!.nodes.map((n: any) => n.data.state)).toEqual([
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("marks only the current step of an ACTIVE run as current", () => {
    wire({ pipelines: [pipeline()], runs: [run({ status: "running" })] });
    render(<Loom />);

    const byId = Object.fromEntries(
      h.props!.nodes.map((n: any) => [n.id, n.data.isCurrent])
    );
    expect(byId).toEqual({ fetch: false, build: true, ship: false });
  });

  it("marks NO step current once the run has finished", () => {
    // A finished run still carries `currentStep`; treating that as live would
    // leave a permanently "executing" node on a run that ended hours ago.
    wire({
      pipelines: [pipeline()],
      runs: [run({ status: "complete", currentStep: "ship" })],
    });
    render(<Loom />);

    expect(h.props!.nodes.every((n: any) => n.data.isCurrent === false)).toBe(true);
  });

  it("animates only the edge feeding the currently executing step", () => {
    wire({ pipelines: [pipeline()], runs: [run({ currentStep: "ship" })] });
    render(<Loom />);

    const animated = h.props!.edges
      .filter((e: any) => e.animated)
      .map((e: any) => e.id);
    expect(animated).toEqual(["build->ship"]);
  });

  it("animates nothing when the run is not active", () => {
    wire({
      pipelines: [pipeline()],
      runs: [run({ status: "error", currentStep: "ship" })],
    });
    render(<Loom />);
    expect(h.props!.edges.some((e: any) => e.animated)).toBe(false);
  });

  it("hides the React Flow attribution", () => {
    wire({ pipelines: [pipeline()] });
    render(<Loom />);
    expect(h.props!.proOptions).toEqual({ hideAttribution: true });
  });
});

// ============================================================
// Step docs panel
// ============================================================

describe("Loom — step docs", () => {
  it("prompts to select a step before one is chosen", () => {
    wire({ pipelines: [pipeline()] });
    render(<Loom />);
    expect(screen.getByText(/select a step to read its docs/i)).toBeInTheDocument();
  });

  it("shows a step's docMd after clicking its node", () => {
    wire({ pipelines: [pipeline()] });
    render(<Loom />);

    fireEvent.click(screen.getByTestId("node-fetch"));
    expect(screen.getByText(/pulls the source/i)).toBeInTheDocument();
  });

  it("says so for a step with no docs rather than rendering an empty panel", () => {
    wire({ pipelines: [pipeline()] });
    render(<Loom />);

    fireEvent.click(screen.getByTestId("node-build"));
    expect(screen.getByText(/no docs for this step yet/i)).toBeInTheDocument();
  });

  it("renders docMd as TEXT, never as HTML", () => {
    // docMd is authored by a skill from source files; rendering it as HTML
    // would be a stored-XSS surface for zero benefit. The assertion is that
    // the markup arrives escaped and no element is actually created.
    wire({
      pipelines: [
        pipeline({
          steps: [
            {
              id: "fetch",
              name: "Fetch",
              docMd: "<img src=x onerror=alert(1)><b>bold</b>",
            },
          ],
        }),
      ],
    });
    const { container } = render(<Loom />);

    fireEvent.click(screen.getByTestId("node-fetch"));

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(
      screen.getByText("<img src=x onerror=alert(1)><b>bold</b>")
    ).toBeInTheDocument();
  });
});

// ============================================================
// Runs list
// ============================================================

describe("Loom — runs", () => {
  it("says there are no runs, and names the emitter, when the list is empty", () => {
    wire({ pipelines: [pipeline()], runs: [] });
    render(<Loom />);

    expect(screen.getByText(/no runs yet/i)).toBeInTheDocument();
    expect(screen.getByText(/loom-emit\.mjs/)).toBeInTheDocument();
  });

  it("counts the runs in the heading", () => {
    wire({
      pipelines: [pipeline()],
      runs: [run({ _id: "a" }), run({ _id: "b" })],
    });
    render(<Loom />);
    expect(screen.getByText(/Runs \(2\)/)).toBeInTheDocument();
  });

  it("defaults to the newest run (the first the server returned)", () => {
    wire({
      pipelines: [pipeline()],
      runs: [
        run({ _id: "newest", currentStep: "ship" }),
        run({ _id: "older", currentStep: "fetch" }),
      ],
    });
    render(<Loom />);

    const animated = h.props!.edges.filter((e: any) => e.animated).map((e: any) => e.id);
    expect(animated).toEqual(["build->ship"]);
  });

  it("selecting an older run re-renders the graph from THAT run", () => {
    // The graph must follow the selection, not stay pinned to the newest —
    // otherwise the run list is decorative.
    wire({
      pipelines: [pipeline()],
      runs: [
        run({ _id: "newest", status: "complete", currentStep: "ship", stepEvents: [] }),
        run({
          _id: "older",
          status: "running",
          currentStep: "build",
          stepEvents: [{ stepId: "fetch", event: "error", at: 1 }],
        }),
      ],
    });
    render(<Loom />);

    // Before: newest run, no events -> all pending.
    expect(h.props!.nodes.map((n: any) => n.data.state)).toEqual([
      "pending",
      "pending",
      "pending",
    ]);

    const buttons = screen.getAllByTestId(/^loom-run-/);
    fireEvent.click(buttons[1]);

    expect(h.props!.nodes[0].data.state).toBe("error");
    expect(h.props!.nodes[1].data.isCurrent).toBe(true);
  });

  it("labels each run button with its status", () => {
    wire({
      pipelines: [pipeline()],
      runs: [run({ _id: "a", status: "error" })],
    });
    render(<Loom />);
    expect(screen.getByTestId("loom-run-error")).toBeInTheDocument();
  });
});

// ============================================================
// Pipeline selector
// ============================================================

describe("Loom — pipeline selector", () => {
  it("is hidden when only one pipeline exists", () => {
    wire({ pipelines: [pipeline()] });
    render(<Loom />);
    // The single pipeline's name appears as the heading, not as a chip button.
    expect(screen.queryByRole("button", { name: "Nightly Build" })).toBeNull();
  });

  it("renders a chip per pipeline when several exist, and switches on click", () => {
    wire({
      pipelines: [
        pipeline(),
        pipeline({ _id: "p2", slug: "deploy", name: "Deploy", steps: [{ id: "push", name: "Push" }] }),
      ],
    });
    render(<Loom />);

    expect(screen.getByRole("button", { name: "Nightly Build" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Deploy" }));

    expect(h.props!.nodes.map((n: any) => n.id)).toEqual(["push"]);
  });
});
