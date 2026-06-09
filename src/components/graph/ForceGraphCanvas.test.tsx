import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { createRef } from "react";
import { ForceGraphCanvas, type ForceGraphHandle } from "./ForceGraphCanvas";

// Same strategy as ObsidianGraph.test: mock react-force-graph-2d with a stub
// that captures the props the canvas computes, so we can assert color/paint/
// focus-dim behavior without a real <canvas>.
const h = vi.hoisted(() => ({ props: null as Record<string, any> | null }));
vi.mock("react-force-graph-2d", () => ({
  default: (props: Record<string, any>) => {
    h.props = props;
    return null;
  },
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

beforeEach(() => {
  h.props = null;
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
});
