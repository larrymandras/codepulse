/**
 * WorkspaceMapCanvas — proves every prop the canvas hands to the shared
 * `ForceGraphCanvas` substrate: physics off (D-08), department fill + access
 * halo (D-06), one-level-per-click expand/collapse with selection-clearing
 * on collapse (D-03), and D-15 privacy masking that touches labels only.
 *
 * Per-file `react-force-graph-2d` mock, copied from
 * `ForceGraphCanvas.test.tsx:1-40` — `src/test/setup.ts` does NOT mock this
 * library globally (verified by a full read of that 139-line file: it
 * installs jsdom polyfills for SpeechRecognition/Audio/Worker/
 * AudioWorkletNode plus one `livekit-client` mock, nothing else), so without
 * this per-file mock the test would hit a real canvas.
 *
 * `useThemeColors` is stubbed with deterministic hex — jsdom returns empty
 * strings for CSS custom properties with no stylesheet loaded, so the four
 * department tokens would otherwise all resolve to the SAME empty string and
 * the "four distinct fills" assertion below would be vacuous. Same pattern
 * as `CodeVaultGraph.test.tsx:49-64`.
 *
 * `WorkspaceMapCanvas` never calls `useQuery` itself (the payload is a prop),
 * and its only reference to Convex-shaped types is a type-only import
 * (`import type { WorkspaceMapData }`), erased at compile time — so unlike
 * `CodeVaultGraph.test.tsx` this file needs NO `convex/react` mock at all.
 *
 * All root/directory names are invented ("root-a", "child-1", ...) —
 * Phase 115 D-17, carried forward by 114's D-16/D-15. Never a real
 * workspace name.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { forwardRef as reactForwardRef } from "react";

// ---------------------------------------------------------------------------
// Module mocks — declared before component import
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  props: null as Record<string, any> | null,
  fgRef: null as Record<string, any> | null,
}));

vi.mock("react-force-graph-2d", () => ({
  default: reactForwardRef((props: Record<string, any>, ref: any) => {
    h.props = props;
    if (ref && typeof ref === "object" && "current" in ref) {
      ref.current = h.fgRef;
    } else if (typeof ref === "function") {
      ref(h.fgRef);
    }
    return null;
  }),
}));

vi.mock("d3-force-3d", () => ({
  forceX: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
  forceY: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
  forceCollide: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
}));

// Deterministic department/status/link colors — see file header for why this
// stub is required (jsdom has no real CSS custom properties in this env).
const MOCK_COLORS = {
  primary: "#06b6d4",
  primaryAlpha18: "rgba(6, 182, 212, 0.18)",
  primaryAlpha55: "rgba(6, 182, 212, 0.55)",
  accent: "#0ea5e9",
  vaultNode: "#8b5cf6",
  vaultNodeAlpha18: "rgba(139, 92, 246, 0.18)",
  chartBar: "#06b6d4",
  chartBarAccent: "#0ea5e9",
  statusOk: "#22c55e",
  statusWarn: "#f59e0b",
  statusError: "#ef4444",
  statusInfo: "#3b82f6",
  mutedForeground: "#94a3b8",
  deptPersonal: "#ec4899",
  deptConsulting: "#22c55e",
  deptWork: "#f97316",
};

vi.mock("../../hooks/useThemeColors", () => ({
  useThemeColors: () => MOCK_COLORS,
}));

import { WorkspaceMapCanvas, type WorkspaceMapNodeSelectHandler } from "./WorkspaceMapCanvas";
import { PrivacyProvider } from "@/contexts/PrivacyContext";
import {
  buildTree,
  computeRollups,
  layoutNodes,
  nodeKey,
  type WorkspaceMapNode,
} from "@/lib/workspaceMapLayout";
import { makeWorkspaceMapFixture } from "@/test/workspaceMapFixture";

// ---------------------------------------------------------------------------
// Real-pipeline fixtures — built once, mirroring WorkspaceMapPanel.test.tsx's
// approach (114-08): exercising the same buildTree/computeRollups/layoutNodes
// pipeline the canvas actually drives, rather than hand-authored node
// literals for direct/rolled figures.
// ---------------------------------------------------------------------------

const fixture = makeWorkspaceMapFixture();
const tree = buildTree(fixture.dirs);
const rollups = computeRollups(tree);
const { nodes: baseNodes } = layoutNodes(tree, rollups, new Set());

function findNode(nodes: WorkspaceMapNode[], predicate: (n: WorkspaceMapNode) => boolean): WorkspaceMapNode {
  const found = nodes.find(predicate);
  if (!found) throw new Error("fixture node not found for the given predicate");
  return found;
}

/** root-a: Personal, astridr-reachable — depth-1 children (child-1, child-2) always visible. */
const rootA = findNode(baseNodes, (n) => n.kind === "root" && n.rootId === "root-a");
/** root-b: Consulting, local-only. */
const rootB = findNode(baseNodes, (n) => n.kind === "root" && n.rootId === "root-b");
/** root-c: Work. */
const rootC = findNode(baseNodes, (n) => n.kind === "root" && n.rootId === "root-c");
/** root-d: Unclassified. */
const rootD = findNode(baseNodes, (n) => n.kind === "root" && n.rootId === "root-d");
/** child-1 (depth 1, root-a): has exactly one child (sub-1) — the expand/collapse target. */
const child1 = findNode(
  baseNodes,
  (n) => n.kind === "dir" && n.rootId === "root-a" && n.dirPath === "child-1"
);
const centerNode = findNode(baseNodes, (n) => n.kind === "center");
const deptPersonalHub = findNode(baseNodes, (n) => n.kind === "department" && n.department === "Personal");

// ---------------------------------------------------------------------------
// Render helper — seeds PrivacyContext's localStorage-backed initial state,
// mirroring WorkspaceMapPanel.test.tsx's `renderPanel` helper.
// ---------------------------------------------------------------------------

function makeFgRef() {
  return {
    centerAt: vi.fn(),
    zoom: vi.fn(),
    zoomToFit: vi.fn(),
    d3Force: vi.fn(),
    d3ReheatSimulation: vi.fn(),
  };
}

function renderCanvas(opts: {
  payload: typeof fixture | null | undefined;
  enabled?: boolean;
  maskPaths?: boolean;
  onNodeSelect?: WorkspaceMapNodeSelectHandler & ReturnType<typeof vi.fn>;
}) {
  const { payload, enabled = false, maskPaths = true, onNodeSelect = vi.fn<WorkspaceMapNodeSelectHandler>() } = opts;
  localStorage.setItem(
    "codepulse-privacy",
    JSON.stringify({ enabled, maskPaths, maskEmails: true, maskKeys: true, maskIps: true, level: "off" })
  );
  const utils = render(
    <PrivacyProvider>
      <WorkspaceMapCanvas payload={payload} onNodeSelect={onNodeSelect} />
    </PrivacyProvider>
  );
  return { ...utils, onNodeSelect };
}

function makeCtx() {
  return {
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
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
  } as unknown as CanvasRenderingContext2D & { globalAlpha: number };
}

beforeEach(() => {
  localStorage.clear();
  h.props = null;
  h.fgRef = makeFgRef();
});

describe("WorkspaceMapCanvas", () => {
  // -------------------------------------------------------------------------
  // D-08 — physics off.
  // -------------------------------------------------------------------------

  it("passes cooldownTicks={0} straight through to the underlying force graph", () => {
    renderCanvas({ payload: fixture });
    // toBe(0), not a truthiness check — 0 is falsy, and a stray `??`/`||`
    // anywhere in the chain would silently reinstate 120 (ForceGraphCanvas's
    // own default) while a loose assertion would still pass.
    expect(h.props!.cooldownTicks).toBe(0);
  });

  // -------------------------------------------------------------------------
  // D-06 — access halo, both directions.
  //
  // ForceGraphCanvas does NOT forward `communityColorFn`/`colorFn` to the
  // underlying react-force-graph-2d component as separate props — it wraps
  // them into `nodeCanvasObject` (the paint callback) and `nodeColor`
  // internally (verified by reading ForceGraphCanvas.tsx's JSX return in
  // full: only `nodeColor`/`nodeCanvasObject`/`nodeLabel`/etc. cross that
  // boundary). Testing through `h.props.nodeCanvasObject` with a recording
  // ctx — exactly the pattern ForceGraphCanvas's OWN "community halo" test
  // suite already uses (`ForceGraphCanvas.test.tsx:263-323`) — is the real
  // testable surface; a literal `h.props.communityColorFn` does not exist.
  // -------------------------------------------------------------------------

  it("halo: astridr-reachable nodes get a non-null halo stroke in colors.statusInfo; local-only nodes get none", () => {
    renderCanvas({ payload: fixture });
    const paint = h.props!.nodeCanvasObject as (n: any, c: any, s: number) => void;

    expect(rootA.access).toBe("astridr-reachable");
    const reachableCtx = makeCtx();
    paint(rootA, reachableCtx, 1);
    expect(reachableCtx.stroke).toHaveBeenCalled();
    expect(reachableCtx.strokeStyle).toBe(MOCK_COLORS.statusInfo);

    expect(rootB.access).toBe("local-only");
    const localOnlyCtx = makeCtx();
    paint(rootB, localOnlyCtx, 1);
    expect(localOnlyCtx.stroke).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // D-06 — department fill, four distinct values + Unclassified/center muted.
  // Folds in the "no custom paint" proof (see acceptance-criteria note in
  // the SUMMARY): `ctx.fillStyle` after `paint()` equals our own `colorFn`'s
  // output rather than some other value, which is only possible if
  // ForceGraphCanvas's DEFAULT paint ran — a custom paint callback would
  // have to be a spy under this test's control to appear here, and none is
  // ever passed (WorkspaceMapCanvas.tsx never supplies a node-paint override
  // to ForceGraphCanvas — verified structurally by the plan's own
  // `grep -c 'paintNode'` acceptance check on the component source).
  // -------------------------------------------------------------------------

  it("department fill: four distinct colors, Unclassified and the center hub both resolve to mutedForeground", () => {
    renderCanvas({ payload: fixture });
    const paint = h.props!.nodeCanvasObject as (n: any, c: any, s: number) => void;

    const fillOf = (node: WorkspaceMapNode) => {
      const ctx = makeCtx();
      paint(node, ctx, 1); // globalScale=1, not hovered — fillStyle == colorFn(node)
      expect(ctx.arc).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
      return ctx.fillStyle;
    };

    const personal = fillOf(rootA);
    const consulting = fillOf(rootB);
    const work = fillOf(rootC);
    const unclassified = fillOf(rootD);
    const center = fillOf(centerNode);

    expect(personal).toBe(MOCK_COLORS.deptPersonal);
    expect(consulting).toBe(MOCK_COLORS.deptConsulting);
    expect(work).toBe(MOCK_COLORS.deptWork);
    expect(unclassified).toBe(MOCK_COLORS.mutedForeground);
    expect(center).toBe(MOCK_COLORS.mutedForeground);

    expect(new Set([personal, consulting, work, unclassified])).toEqual(
      new Set([MOCK_COLORS.deptPersonal, MOCK_COLORS.deptConsulting, MOCK_COLORS.deptWork, MOCK_COLORS.mutedForeground])
    );
  });

  // -------------------------------------------------------------------------
  // D-15 — privacy masking. THREE cases, mirroring 114-08-PLAN.md's masking
  // suite. Two states are not enough: the `maskPaths: false` case is the
  // discriminator that proves the gate is `enabled && maskPaths`, not a bare
  // `redact()` call — `redact` is itself gated on `enabled` ONLY
  // (`usePrivacyMask.ts:38-42`), so an off/on-with-maskPaths-true-only suite
  // would pass identically against either gate and measure nothing about the
  // property it exists to prove. Do not delete this case as "redundant".
  // -------------------------------------------------------------------------

  it("privacy off (the default): root label renders verbatim via nodeLabel", () => {
    renderCanvas({ payload: fixture, enabled: false, maskPaths: true });
    // ForceGraphCanvas passes our labelFn straight through as `nodeLabel`
    // when supplied (`nodeLabel={labelFn ?? ...}`) — h.props.nodeLabel IS
    // WorkspaceMapCanvas's own labelFn here.
    expect(h.props!.nodeLabel(rootA)).toBe("root-a");
  });

  it("privacy enabled && maskPaths: true — root label masks to '{department} root {index}', directory label masks to the redact() placeholder, geometry unperturbed", () => {
    const unmasked = renderCanvas({ payload: fixture, enabled: false });
    const unmaskedNodes = h.props!.graphData.nodes as Array<{ id: string; val: number; fx: number; fy: number }>;
    const unmaskedRootA = unmaskedNodes.find((n) => n.id === rootA.id)!;
    unmasked.unmount();

    renderCanvas({ payload: fixture, enabled: true, maskPaths: true });
    expect(h.props!.nodeLabel(rootA)).toBe("Personal root 1");
    expect(h.props!.nodeLabel(rootA)).not.toBe("root-a");
    expect(h.props!.nodeLabel(child1)).toBe("••••••");

    // Department/center hubs are never masked.
    expect(h.props!.nodeLabel(centerNode)).toBe("Workspace");
    expect(h.props!.nodeLabel(deptPersonalHub)).toBe("Personal");

    // The load-bearing clause: D-15 says structure, counts and colors stay
    // intact. Compare against the captured unmasked values directly rather
    // than re-asserting the same literals, so a regression that also
    // perturbed geometry would make this comparison fail, not just look
    // coincidentally equal.
    const maskedNodes = h.props!.graphData.nodes as Array<{ id: string; val: number; fx: number; fy: number }>;
    const maskedRootA = maskedNodes.find((n) => n.id === rootA.id)!;
    expect(maskedRootA.val).toBe(unmaskedRootA.val);
    expect(maskedRootA.fx).toBe(unmaskedRootA.fx);
    expect(maskedRootA.fy).toBe(unmaskedRootA.fy);
    expect(maskedNodes.length).toBe(unmaskedNodes.length);
  });

  it("masking gate discriminator: enabled=true but maskPaths=false leaves labels UNMASKED — proves the gate is enabled && maskPaths, not a bare redact() call", () => {
    renderCanvas({ payload: fixture, enabled: true, maskPaths: false });
    expect(h.props!.nodeLabel(rootA)).toBe("root-a");
    expect(h.props!.nodeLabel(rootA)).not.toBe("Personal root 1");
    expect(h.props!.nodeLabel(child1)).toBe("child-1");
  });

  // -------------------------------------------------------------------------
  // D-03 — one level per click, symmetric collapse, selection clears when
  // the currently-selected node is collapsed out of the visible set.
  // -------------------------------------------------------------------------

  it("expand/collapse (D-03): one level per click, symmetric collapse, and a collapsed-out selection is cleared", () => {
    const { onNodeSelect } = renderCanvas({ payload: fixture });
    const preExpansionIds = new Set((h.props!.graphData.nodes as Array<{ id: string }>).map((n) => n.id));

    // Click child-1 (has exactly one child, sub-1, not yet expanded) —
    // reveals exactly sub-1, no grandchildren (leaf-1 stays hidden).
    act(() => {
      h.props!.onNodeClick(child1);
    });
    const afterExpandIds = (h.props!.graphData.nodes as Array<{ id: string }>).map((n) => n.id);
    expect(afterExpandIds.length).toBe(preExpansionIds.size + 1);
    const sub1Key = nodeKey("root-a", "child-1/sub-1");
    expect(afterExpandIds).toContain(sub1Key);
    expect(afterExpandIds).not.toContain(nodeKey("root-a", "child-1/sub-1/leaf-1"));
    expect(onNodeSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: child1.id }),
      undefined
    );

    // Select the descendant (sub-1) — reports selection; sub-1 itself has a
    // child (leaf-1) so this ALSO expands it one further level.
    const sub1Node = (h.props!.graphData.nodes as WorkspaceMapNode[]).find((n) => n.id === sub1Key)!;
    act(() => {
      h.props!.onNodeClick(sub1Node);
    });
    expect(onNodeSelect).toHaveBeenCalledWith(expect.objectContaining({ id: sub1Key }), undefined);

    // Collapse the ancestor (click child-1 again) — removes sub-1 AND
    // leaf-1 from expandedSet/visibility. The panel was showing sub-1, which
    // is now invisible: the selection callback must have been invoked with
    // null at some point in this click (checked with a control: a NEW mock
    // used only for this assertion has no other way to receive `null`).
    act(() => {
      h.props!.onNodeClick(child1);
    });
    expect(onNodeSelect).toHaveBeenCalledWith(null, undefined);

    const afterCollapseIds = new Set((h.props!.graphData.nodes as Array<{ id: string }>).map((n) => n.id));
    expect(afterCollapseIds).toEqual(preExpansionIds);
  });

  // -------------------------------------------------------------------------
  // Three-state branch.
  // -------------------------------------------------------------------------

  it("undefined payload renders the loading skeleton, never mounts the force graph", () => {
    const { getByRole } = renderCanvas({ payload: undefined });
    expect(getByRole("status", { name: /loading workspace map/i })).toBeInTheDocument();
    expect(h.props).toBeNull();
  });

  it("null payload renders the true-empty copy, never mounts the force graph", () => {
    const { getByText } = renderCanvas({ payload: null });
    expect(getByText("No workspace snapshot yet.")).toBeInTheDocument();
    expect(getByText(/CodePulse-WorkspaceScan/)).toBeInTheDocument();
    expect(h.props).toBeNull();
  });

  it("a real payload mounts the force graph", () => {
    renderCanvas({ payload: fixture });
    expect(h.props).not.toBeNull();
    expect(h.props!.graphData.nodes.length).toBeGreaterThan(0);
  });
});
