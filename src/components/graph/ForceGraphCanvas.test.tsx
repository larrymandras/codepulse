import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { createRef, forwardRef as reactForwardRef } from "react";
import { ForceGraphCanvas, type ForceGraphHandle } from "./ForceGraphCanvas";

// Same strategy as ObsidianGraph.test: mock react-force-graph-2d with a stub
// that captures the props the canvas computes, so we can assert color/paint/
// focus-dim behavior without a real <canvas>.
const h = vi.hoisted(() => ({
  props: null as Record<string, any> | null,
  fgRef: null as Record<string, any> | null,
}));

// Use forwardRef so React properly sets fgRef.current to the mock's imperative handle.
vi.mock("react-force-graph-2d", () => ({
  default: reactForwardRef((props: Record<string, any>, ref: any) => {
    h.props = props;
    // Expose mock d3Force/d3ReheatSimulation via the ref so the component's useEffect can call them.
    if (ref && typeof ref === "object" && "current" in ref) {
      ref.current = h.fgRef;
    } else if (typeof ref === "function") {
      ref(h.fgRef);
    }
    return null;
  }),
}));

// Mock d3-force-3d so tests don't need the real simulation.
vi.mock("d3-force-3d", () => ({
  forceX: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
  forceY: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
  forceCollide: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
}));

const data = {
  nodes: [
    { id: "a", name: "Alpha", val: 5 },
    { id: "b", name: "Beta", val: 3 },
  ],
  links: [{ source: "a", target: "b" }],
};

function makeCtx() {
  return {
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 20 })),
    shadowColor: "",
    shadowBlur: 0,
    fillStyle: "",
    globalAlpha: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
  } as unknown as CanvasRenderingContext2D & { globalAlpha: number };
}

// jsdom doesn't implement window.matchMedia — provide a stub.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

function makeFgRef() {
  return {
    centerAt: vi.fn(),
    zoom: vi.fn(),
    zoomToFit: vi.fn(),
    d3Force: vi.fn(),
    d3ReheatSimulation: vi.fn(),
  };
}

beforeEach(() => {
  h.props = null;
  h.fgRef = makeFgRef();
});

describe("ForceGraphCanvas", () => {
  it("passes data straight through to graphData", () => {
    render(<ForceGraphCanvas data={data} />);
    expect(h.props!.graphData).toBe(data);
  });

  it("applies colorFn to nodeColor", () => {
    render(
      <ForceGraphCanvas
        data={data}
        colorFn={(n: any) => (n.id === "a" ? "#111111" : "#222222")}
      />,
    );
    expect(h.props!.nodeColor({ id: "a" })).toBe("#111111");
    expect(h.props!.nodeColor({ id: "b" })).toBe("#222222");
  });

  it("uses the default emerald color when no colorFn supplied", () => {
    render(<ForceGraphCanvas data={data} />);
    expect(h.props!.nodeColor({ id: "a" })).toBe("#10b981");
  });

  it("dims a node outside the focus set via globalAlpha", () => {
    render(<ForceGraphCanvas data={data} focusSet={new Set(["a"])} />);
    const paint = h.props!.nodeCanvasObject as (n: any, c: any, s: number) => void;

    const dimCtx = makeCtx();
    paint({ id: "b", name: "Beta", x: 0, y: 0, val: 3 }, dimCtx, 1);
    // node "b" is NOT in the focus set → painted dimmed (alpha set to 0.2 then reset)
    expect(dimCtx.arc).toHaveBeenCalled();

    // The focused node "a" should paint at full alpha.
    const fullCtx = makeCtx();
    paint({ id: "a", name: "Alpha", x: 0, y: 0, val: 5 }, fullCtx, 1);
    expect(fullCtx.arc).toHaveBeenCalled();
  });

  it("invokes a custom paintNode with hover/dim opts", () => {
    const paintSpy = vi.fn();
    render(
      <ForceGraphCanvas
        data={data}
        paintNode={paintSpy}
        focusSet={new Set(["a"])}
      />,
    );
    const paint = h.props!.nodeCanvasObject as (n: any, c: any, s: number) => void;
    const ctx = makeCtx();
    paint({ id: "b", name: "Beta", x: 1, y: 2, val: 3 }, ctx, 2);
    expect(paintSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: "b" }),
      ctx,
      2,
      expect.objectContaining({ hovered: false, dimmed: true }),
    );
  });

  it("forwards linkColorFn / linkWidthFn", () => {
    render(
      <ForceGraphCanvas
        data={data}
        linkColorFn={() => "#abcabc"}
        linkWidthFn={() => 4}
      />,
    );
    expect(h.props!.linkColor({})).toBe("#abcabc");
    expect(h.props!.linkWidth({})).toBe(4);
  });

  it("exposes an imperative centerAt/zoom handle", () => {
    const ref = createRef<ForceGraphHandle>();
    render(<ForceGraphCanvas ref={ref} data={data} />);
    // The handle methods exist (they no-op until the inner ref attaches).
    expect(typeof ref.current?.centerAt).toBe("function");
    expect(typeof ref.current?.zoom).toBe("function");
    expect(() => ref.current?.centerAt(0, 0, 100)).not.toThrow();
  });

  it("exposes d3Force and d3ReheatSimulation on the imperative handle", () => {
    const ref = createRef<ForceGraphHandle>();
    render(<ForceGraphCanvas ref={ref} data={data} />);
    expect(typeof ref.current?.d3Force).toBe("function");
    expect(typeof ref.current?.d3ReheatSimulation).toBe("function");
  });
});

// ── Cluster force injection (SC#3 / SC#4) ────────────────────────────────────

describe("ForceGraphCanvas — cluster force injection", () => {
  const nodesWithCommunity = [
    { id: "a", name: "Alpha", val: 5, community: 0 },
    { id: "b", name: "Beta", val: 3, community: 1 },
    { id: "c", name: "Gamma", val: 2, community: 0 },
  ];

  const nodesNoCommunity = [
    { id: "a", name: "Alpha", val: 5, community: null },
    { id: "b", name: "Beta", val: 3, community: null },
  ];

  it("SC#3: registers clusterX/clusterY/clusterCollide forces when community data is present and clusterForce=true", async () => {
    const ref = createRef<ForceGraphHandle>();
    await act(async () => {
      render(
        <ForceGraphCanvas
          ref={ref}
          data={{ nodes: nodesWithCommunity, links: [] }}
          clusterForce={true}
        />,
      );
    });
    expect(h.fgRef!.d3Force).toHaveBeenCalledWith("clusterX", expect.anything());
    expect(h.fgRef!.d3Force).toHaveBeenCalledWith("clusterY", expect.anything());
    expect(h.fgRef!.d3Force).toHaveBeenCalledWith("clusterCollide", expect.anything());
    expect(h.fgRef!.d3ReheatSimulation).toHaveBeenCalled();
  });

  it("SC#4: sets cluster forces to null when no node has a non-null community", async () => {
    const ref = createRef<ForceGraphHandle>();
    await act(async () => {
      render(
        <ForceGraphCanvas
          ref={ref}
          data={{ nodes: nodesNoCommunity, links: [] }}
          clusterForce={true}
        />,
      );
    });
    expect(h.fgRef!.d3Force).toHaveBeenCalledWith("clusterX", null);
    expect(h.fgRef!.d3Force).toHaveBeenCalledWith("clusterY", null);
    expect(h.fgRef!.d3Force).toHaveBeenCalledWith("clusterCollide", null);
    expect(h.fgRef!.d3ReheatSimulation).not.toHaveBeenCalled();
  });

  it("does not touch cluster forces when clusterForce prop is not set", async () => {
    await act(async () => {
      render(
        <ForceGraphCanvas
          data={{ nodes: nodesWithCommunity, links: [] }}
        />,
      );
    });
    // d3Force should not be called when clusterForce=false/undefined
    expect(h.fgRef!.d3Force).not.toHaveBeenCalled();
  });
});

// ── Community halo paint (communityColorFn) ──────────────────────────────────

describe("ForceGraphCanvas — community halo via communityColorFn", () => {
  function makeRecordingCtx() {
    const calls: string[] = [];
    return {
      beginPath: vi.fn(() => { calls.push("beginPath"); }),
      arc: vi.fn(() => { calls.push("arc"); }),
      fill: vi.fn(() => { calls.push("fill"); }),
      stroke: vi.fn(() => { calls.push("stroke"); }),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 20 })),
      shadowColor: "",
      shadowBlur: 0,
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 0,
      globalAlpha: 1,
      font: "",
      textAlign: "",
      textBaseline: "",
      _calls: calls,
    } as unknown as CanvasRenderingContext2D & { _calls: string[] };
  }

  const nodeWithCommunity = { id: "a", name: "Alpha", x: 0, y: 0, val: 5, community: 2 };
  const nodeNoCommunity = { id: "b", name: "Beta", x: 0, y: 0, val: 3, community: null };

  it("draws a halo stroke when communityColorFn returns a non-null hex", () => {
    render(
      <ForceGraphCanvas
        data={{ nodes: [nodeWithCommunity], links: [] }}
        communityColorFn={(n: any) => (n.community != null ? "#fbbf24" : null)}
      />,
    );
    const paint = h.props!.nodeCanvasObject as (n: any, c: any, s: number) => void;
    const ctx = makeRecordingCtx();
    paint(nodeWithCommunity, ctx, 1);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("draws no halo stroke when communityColorFn returns null", () => {
    render(
      <ForceGraphCanvas
        data={{ nodes: [nodeNoCommunity], links: [] }}
        communityColorFn={(_n: any) => null}
      />,
    );
    const paint = h.props!.nodeCanvasObject as (n: any, c: any, s: number) => void;
    const ctx = makeRecordingCtx();
    paint(nodeNoCommunity, ctx, 1);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it("draws no halo when communityColorFn is not supplied", () => {
    render(<ForceGraphCanvas data={{ nodes: [nodeWithCommunity], links: [] }} />);
    const paint = h.props!.nodeCanvasObject as (n: any, c: any, s: number) => void;
    const ctx = makeRecordingCtx();
    paint(nodeWithCommunity, ctx, 1);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });
});
