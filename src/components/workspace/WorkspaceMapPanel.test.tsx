/**
 * WorkspaceMapPanel — D-09 field proof + D-15 masking proof.
 *
 * Nodes under test are produced by the REAL `buildTree` / `computeRollups` /
 * `layoutNodes` pipeline (114-05/114-07) over `makeWorkspaceMapFixture()`'s
 * synthetic rows (114-03), rather than hand-authored `WorkspaceMapNode`
 * literals — this exercises the same object shape the canvas will actually
 * hand the panel, and the direct-vs-rolled figures below are genuinely
 * DERIVED (rollup arithmetic), not asserted-because-hardcoded.
 *
 * All root/directory names are invented ("root-a", "child-1", ...) —
 * Phase 115 D-17, carried forward by 114's D-16/D-15. Never a real
 * workspace name.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { WorkspaceMapPanel } from "./WorkspaceMapPanel";
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
// Build the real node set once — expand root-a/child-1 and
// root-a/child-1/sub-1 so the fixture's depth-2/depth-3 rows (which encode
// the "two zero-file cases" distinction) are actually present in the
// visible node set (D-03: a level is only visible once its parent key is in
// expandedSet).
// ---------------------------------------------------------------------------

const fixtureDirs = makeWorkspaceMapFixture().dirs;
const tree = buildTree(fixtureDirs);
const rollups = computeRollups(tree);
const expandedSet = new Set([
  nodeKey("root-a", "child-1"),
  nodeKey("root-a", "child-1/sub-1"),
]);
const { nodes } = layoutNodes(tree, rollups, expandedSet);

function findNode(predicate: (n: WorkspaceMapNode) => boolean): WorkspaceMapNode {
  const found = nodes.find(predicate);
  if (!found) throw new Error("fixture node not found for the given predicate");
  return found;
}

/** root-a: Personal, astridr-reachable. direct fileCount 5, rolled 10 (5 own + 3 child-1 subtree + 2 child-2). */
const rootA = findNode((n) => n.kind === "root" && n.rootId === "root-a");
/** root-b: Consulting, local-only. */
const rootB = findNode((n) => n.kind === "root" && n.rootId === "root-b");
/** depth-1, withheldCount 2 (direct) — D-09's withheld-notice case. */
const child1 = findNode((n) => n.kind === "dir" && n.rootId === "root-a" && n.dirPath === "child-1");
/** depth-2, fileCount 0, withheldCount 0 — pure-structure directory. */
const sub1 = findNode(
  (n) => n.kind === "dir" && n.rootId === "root-a" && n.dirPath === "child-1/sub-1"
);
/** depth-3, fileCount 0, withheldCount 4 — everything here was withheld. */
const leaf1 = findNode(
  (n) => n.kind === "dir" && n.rootId === "root-a" && n.dirPath === "child-1/sub-1/leaf-1"
);
/** Personal department hub — dirCount 5, rolled.fileCount 10 (root-a's whole subtree). */
const deptPersonal = findNode((n) => n.kind === "department" && n.department === "Personal");

// ---------------------------------------------------------------------------
// Render helper — seeds PrivacyContext's localStorage-backed initial state
// (src/contexts/PrivacyContext.tsx:20-29`loadState`) before mounting the
// REAL PrivacyProvider, so the panel reads `usePrivacy()` from a real
// context rather than a mocked hook — this is what makes the `enabled &&
// maskPaths` gate itself provable, per the plan's discriminator requirement.
// ---------------------------------------------------------------------------

function renderPanel(
  node: WorkspaceMapNode | null,
  opts: { enabled?: boolean; maskPaths?: boolean; rootIndex?: number } = {}
) {
  const { enabled = false, maskPaths = true, rootIndex } = opts;
  localStorage.setItem(
    "codepulse-privacy",
    JSON.stringify({
      enabled,
      maskPaths,
      maskEmails: true,
      maskKeys: true,
      maskIps: true,
      level: "off",
    })
  );
  return render(
    <PrivacyProvider>
      <WorkspaceMapPanel node={node} open onOpenChange={() => {}} rootIndex={rootIndex} />
    </PrivacyProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("WorkspaceMapPanel", () => {
  // -------------------------------------------------------------------------
  // Withheld notice — both directions (D-09's "if and only if").
  // -------------------------------------------------------------------------

  it("withheld notice: absent when withheldCount is 0, present with the full explanatory sentence when > 0", () => {
    const { unmount } = renderPanel(sub1); // fileCount 0, withheldCount 0
    expect(screen.queryByText(/withheld/)).not.toBeInTheDocument();
    expect(screen.queryByText(/never left this machine/)).not.toBeInTheDocument();
    unmount();

    renderPanel(child1); // withheldCount 2
    expect(screen.getByText(/2 files withheld/)).toBeInTheDocument();
    expect(
      screen.getByText(/Classified sensitive by the local scanner config/)
    ).toBeInTheDocument();
    expect(screen.getByText(/never left this machine/)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Direct vs rolled-up — both present, each next to its own label.
  // -------------------------------------------------------------------------

  it("direct and rolled-up file counts are both present, each adjacent to its own label", () => {
    // Sanity on the fixture pipeline itself: direct and rolled genuinely differ.
    expect(rootA.direct.fileCount).toBe(5);
    expect(rootA.rolled.fileCount).toBe(10);

    renderPanel(rootA);

    const directRow = screen.getByText("direct").parentElement!;
    expect(within(directRow).getByText(/5 files/)).toBeInTheDocument();

    const rolledRow = screen.getByText("total incl. subdirectories").parentElement!;
    expect(within(rolledRow).getByText(/10 files/)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // The two zero-file cases are distinguishable (114-CONTEXT.md § Specific Ideas).
  // -------------------------------------------------------------------------

  it("a zero-file directory with zero withheld renders no withheld notice; a zero-file directory with withheld files does", () => {
    expect(sub1.direct.fileCount).toBe(0);
    expect(sub1.direct.withheldCount).toBe(0);
    expect(leaf1.direct.fileCount).toBe(0);
    expect(leaf1.direct.withheldCount).toBe(4);

    const { unmount } = renderPanel(sub1);
    expect(screen.queryByText(/files withheld/)).not.toBeInTheDocument();
    unmount();

    renderPanel(leaf1);
    expect(screen.getByText(/4 files withheld/)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Access copy — plain language, never the raw enum.
  // -------------------------------------------------------------------------

  it("access renders as 'Reachable by Ástríðr' for astridr-reachable nodes, never the raw enum string", () => {
    renderPanel(rootA);
    expect(screen.getByText("Reachable by Ástríðr")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("astridr-reachable");
    expect(document.body.textContent).not.toContain("local-only");
  });

  it("access renders as 'Local only' for local-only nodes, never the raw enum string", () => {
    renderPanel(rootB);
    expect(screen.getByText("Local only")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("astridr-reachable");
    expect(document.body.textContent).not.toContain("local-only");
  });

  // -------------------------------------------------------------------------
  // Masking — three cases, including the D-15 gate discriminator.
  // -------------------------------------------------------------------------

  it("masking off (the default): the root label renders verbatim", () => {
    renderPanel(rootA, { enabled: false, maskPaths: true });
    expect(screen.getByText("root-a")).toBeInTheDocument();
  });

  it("masking on (enabled && maskPaths): root label masks to '{department} root {index}', but department/access badges and the direct count are unchanged from the unmasked render", () => {
    const unmasked = renderPanel(rootA, { enabled: false });
    const unmaskedBadgeTexts = screen
      .getAllByText(/^(Personal|Reachable by Ástríðr)$/)
      .map((el) => el.textContent);
    const unmaskedDirectValue = screen.getByText(/5 files/).textContent;
    unmasked.unmount();

    renderPanel(rootA, { enabled: true, maskPaths: true, rootIndex: 3 });
    expect(screen.getByText("Personal root 3")).toBeInTheDocument();
    expect(screen.queryByText("root-a")).not.toBeInTheDocument();

    // The load-bearing clause: D-15 says structure, counts and colors stay
    // intact — a component that masked everything would satisfy a
    // masking-only assertion while violating the decision. Compare against
    // the captured unmasked values directly rather than re-asserting the
    // same literals, so a regression that masks the badge/count text too
    // would make this comparison fail, not just look coincidentally equal.
    const maskedBadgeTexts = screen
      .getAllByText(/^(Personal|Reachable by Ástríðr)$/)
      .map((el) => el.textContent);
    expect(maskedBadgeTexts).toEqual(unmaskedBadgeTexts);
    expect(screen.getByText(/5 files/).textContent).toBe(unmaskedDirectValue);
  });

  it("masking on: a directory node's label becomes the plain redact() placeholder", () => {
    renderPanel(child1, { enabled: true, maskPaths: true });
    expect(screen.getByText("••••••")).toBeInTheDocument();
    expect(screen.queryByText("child-1")).not.toBeInTheDocument();
  });

  it("masking gate discriminator: enabled=true but maskPaths=false leaves labels UNMASKED — proves the gate is `enabled && maskPaths`, not a bare redact() call (usePrivacyMask.ts:39-42 gates redact on `enabled` alone)", () => {
    renderPanel(rootA, { enabled: true, maskPaths: false, rootIndex: 3 });
    expect(screen.getByText("root-a")).toBeInTheDocument();
    expect(screen.queryByText("Personal root 3")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Department hub reduced field set.
  // -------------------------------------------------------------------------

  it("department hub renders both dirCount and rolled.fileCount, each with its own label and a non-zero value, and shows no access badge or withheld notice", () => {
    // Sanity: the two values are genuinely distinct, non-zero figures — a
    // 0/undefined/label-only render would fail the assertions below, not
    // just this pre-condition.
    expect(deptPersonal.dirCount).toBeGreaterThan(0);
    expect(deptPersonal.rolled.fileCount).toBeGreaterThan(0);
    expect(deptPersonal.dirCount).not.toBe(deptPersonal.rolled.fileCount);

    renderPanel(deptPersonal);

    const dirRow = screen.getByText("directories").parentElement!;
    expect(within(dirRow).getByText(String(deptPersonal.dirCount))).toBeInTheDocument();

    const fileRow = screen.getByText("files, total incl. subdirectories").parentElement!;
    expect(
      within(fileRow).getByText(String(deptPersonal.rolled.fileCount))
    ).toBeInTheDocument();

    expect(screen.queryByText(/Reachable by Ástríðr|Local only/)).not.toBeInTheDocument();
    expect(screen.queryByText(/withheld/)).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Fallback — no stale content for a node that left the visible set.
  // -------------------------------------------------------------------------

  it("open=true with a null node renders the skeleton fallback, never stale content from a previous node", () => {
    const first = renderPanel(rootA);
    expect(screen.getByText("root-a")).toBeInTheDocument();
    first.unmount();

    const { baseElement } = renderPanel(null);
    expect(baseElement.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByText("root-a")).not.toBeInTheDocument();
  });
});
