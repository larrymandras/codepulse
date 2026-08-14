/**
 * WorkspaceMapCanvas — the D-01..D-08 radial canvas for the workspace map.
 *
 * Owns `expandedSet` (client-side expand/collapse state, D-02/D-03), drives
 * the pure `workspaceMapLayout.ts` module under two memo boundaries (one
 * keyed on the payload's `activeVersion`, since `buildTree`/`computeRollups`
 * only change on a nightly re-push and 114-RESEARCH.md's assumption A1 says
 * Convex's returned `dirs` array is not verified referentially stable across
 * renders; one keyed on `expandedSet`, since the layout legitimately
 * recomputes on every click), and mounts `ForceGraphCanvas` with the cooldown
 * ticks prop set to exactly zero (D-08, physics off) and no custom
 * node-paint callback — the shared default paint already handles
 * fill/hover/dim/labels/halo, per UI-SPEC's
 * "Claude's Discretion — resolved" call not to build a ~60-line custom paint
 * function for marginal benefit.
 *
 * D-15 privacy: gated on `usePrivacy().enabled && maskPaths`, never a bare
 * `redact()` call (`usePrivacyMask.ts:39-42` gates `redact` on `enabled`
 * alone). Masking touches only the rendered node text (both the canvas-drawn
 * label — via each node's `name` field, which `ForceGraphCanvas`'s default
 * paint reads as `node.name ?? node.id` — and the hover tooltip, via the
 * `labelFn` prop) and never `val`/`fx`/`fy`/colors/position, which are read
 * straight off the unmodified `layoutNodes` output (D-15: "structure, counts
 * and colors stay intact").
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ForceGraphCanvas, type ForceGraphHandle } from "@/components/graph/ForceGraphCanvas";
import { useThemeColors, type ThemeColors } from "@/hooks/useThemeColors";
import { usePrivacy } from "@/contexts/PrivacyContext";
import { usePrivacyMask } from "@/hooks/usePrivacyMask";
import type { WorkspaceMapData } from "@/hooks/useWorkspaceMap";
import {
  buildTree,
  computeRollups,
  layoutNodes,
  nodeKey,
  type DirTree,
  type WorkspaceDirRow,
  type WorkspaceMapNode,
} from "@/lib/workspaceMapLayout";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Department -> fill color lookup. Mirrors `WorkspaceMapPanel`'s own
 * (unexported) helper of the same shape — kept local here since this plan's
 * file list doesn't add a shared home for it, and it is small enough that
 * duplicating it is cheaper than introducing a new shared module this phase.
 */
function deptColor(department: string, colors: ThemeColors): string {
  switch (department) {
    case "Personal":
      return colors.deptPersonal;
    case "Consulting":
      return colors.deptConsulting;
    case "Work":
      return colors.deptWork;
    default:
      // "Unclassified", the center hub (department: "") and anything
      // unrecognized all read as muted, never a fifth peer color.
      return colors.mutedForeground;
  }
}

/**
 * The privacy-aware display label for a single node (D-15). Root labels,
 * when masked, become "{department} root {index}" — never a bare redacted
 * placeholder, since 53 identical placeholders would look broken rather than
 * deliberately redacted and roots are the map's primary navigational anchor.
 * Directory labels (depth >= 1), when masked, become the plain placeholder.
 * Department/center hub labels are never masked.
 */
function displayLabel(
  node: WorkspaceMapNode,
  masked: boolean,
  rootIndexByKey: Map<string, number>,
  redact: (text: string, placeholder?: string) => string
): string {
  if (!masked) return node.label;
  if (node.kind === "root") return `${node.department} root ${rootIndexByKey.get(node.id) ?? 0}`;
  if (node.kind === "dir") return redact(node.label);
  return node.label;
}

/**
 * Every structural descendant of `key` in the FULL tree (not just the
 * currently-visible subset) — used both to prune `expandedSet` on collapse
 * (so a later re-expand starts fresh at one level per click, D-03) and to
 * detect whether a collapse invalidates the panel's current selection.
 */
function collectDescendantKeys(tree: DirTree, key: string, into: Set<string>): void {
  const children = tree.childrenByParent.get(key);
  if (!children) return;
  for (const child of children) {
    const childKey = nodeKey(child.rootId, child.dirPath);
    into.add(childKey);
    collectDescendantKeys(tree, childKey, into);
  }
}

const EMPTY_DIRS: WorkspaceDirRow[] = [];

// ---------------------------------------------------------------------------
// WorkspaceMapCanvas
// ---------------------------------------------------------------------------

export type WorkspaceMapNodeSelectHandler = (
  node: WorkspaceMapNode | null,
  rootIndex: number | undefined
) => void;

export interface WorkspaceMapCanvasProps {
  /** The `getWorkspaceMap` payload — three-state passthrough, never coerced:
   *  `undefined` (loading), `null` (no snapshot yet), or the live payload. */
  payload: WorkspaceMapData | null | undefined;
  /** Reports the clicked node (or `null` when a collapse invalidates the
   * currently-selected node) so the page can open/update/close the D-09 side
   * panel. `rootIndex` is only meaningful when the node is a root and
   * privacy masking is active — the page hands it straight through to
   * `WorkspaceMapPanel`, which never recomputes its own ordering. */
  onNodeSelect: WorkspaceMapNodeSelectHandler;
}

export function WorkspaceMapCanvas({ payload, onNodeSelect }: WorkspaceMapCanvasProps) {
  const colors = useThemeColors();
  const { enabled, maskPaths } = usePrivacy();
  const { redact } = usePrivacyMask();
  const masked = enabled && maskPaths;

  const [expandedSet, setExpandedSet] = useState<Set<string>>(() => new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const fgRef = useRef<ForceGraphHandle>(null);

  // ESC to exit fullscreen — same convention as CodeVaultGraph.tsx:292-300.
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen]);

  // ── Boundary A: buildTree + computeRollups, keyed ONLY on activeVersion ──
  const activeVersion = payload?.activeVersion;
  const { tree, rollups } = useMemo(() => {
    const t = buildTree(payload?.dirs ?? EMPTY_DIRS);
    const r = computeRollups(t);
    return { tree: t, rollups: r };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVersion]);

  // ── Boundary B: layoutNodes, the one boundary that legitimately
  // recomputes on every click. ──────────────────────────────────────────────
  const { nodes, links } = useMemo(
    () => layoutNodes(tree, rollups, expandedSet),
    [tree, rollups, expandedSet]
  );

  // Root display-index, descending rolled-file-count within department —
  // MUST be the exact ordering WorkspaceMapPanel (114-08) expects via its
  // `rootIndex` prop, so the canvas's own masked root labels and the panel's
  // masked root label never diverge (114-08-SUMMARY.md's handoff note).
  const rootIndexByKey = useMemo(() => {
    const byDept = new Map<string, WorkspaceDirRow[]>();
    for (const root of tree.roots) {
      const list = byDept.get(root.department);
      if (list) list.push(root);
      else byDept.set(root.department, [root]);
    }
    const map = new Map<string, number>();
    for (const roots of byDept.values()) {
      const sorted = [...roots].sort((a, b) => {
        const rollA = rollups.get(nodeKey(a.rootId, a.dirPath))?.fileCount ?? 0;
        const rollB = rollups.get(nodeKey(b.rootId, b.dirPath))?.fileCount ?? 0;
        const diff = rollB - rollA;
        return diff !== 0 ? diff : a.rootId.localeCompare(b.rootId);
      });
      sorted.forEach((row, idx) => map.set(nodeKey(row.rootId, row.dirPath), idx + 1));
    }
    return map;
  }, [tree, rollups]);

  // Privacy-aware node set fed to ForceGraphCanvas — only `.name` differs
  // from `nodes`; val/fx/fy/id/kind/department/access are untouched.
  const canvasNodes = useMemo(
    () => nodes.map((n) => ({ ...n, name: displayLabel(n, masked, rootIndexByKey, redact) })),
    [nodes, masked, rootIndexByKey, redact]
  );

  const labelFn = useCallback(
    (node: WorkspaceMapNode) => displayLabel(node, masked, rootIndexByKey, redact),
    [masked, rootIndexByKey, redact]
  );

  const colorFn = useCallback(
    (node: WorkspaceMapNode) => deptColor(node.department, colors),
    [colors]
  );

  const communityColorFn = useCallback(
    (node: WorkspaceMapNode) => (node.access === "astridr-reachable" ? colors.statusInfo : null),
    [colors]
  );

  const handleNodeClick = useCallback(
    (node: WorkspaceMapNode) => {
      const key = node.id;
      const hasChildren = (tree.childrenByParent.get(key)?.length ?? 0) > 0;

      if (hasChildren) {
        const next = new Set(expandedSet);
        if (next.has(key)) {
          // Collapse: remove this node's own key plus every descendant key,
          // so a later re-expand starts fresh at one level per click (D-03).
          const descendants = new Set<string>();
          collectDescendantKeys(tree, key, descendants);
          next.delete(key);
          for (const d of descendants) next.delete(d);

          // If the currently-selected node falls inside the subtree just
          // collapsed, it is about to become invisible — clear it BEFORE
          // (unconditionally, below) reporting this click's own node, so the
          // panel never goes on describing an invisible node.
          if (selectedKey !== null && selectedKey !== key && descendants.has(selectedKey)) {
            setSelectedKey(null);
            onNodeSelect(null, undefined);
          }
        } else {
          // Expand: reveal exactly one further level.
          next.add(key);
        }
        setExpandedSet(next);
      }

      // Always report the clicked node so the panel opens/updates. Leaf
      // nodes (no children in the payload) only ever reach this line.
      setSelectedKey(key);
      onNodeSelect(node, node.kind === "root" ? rootIndexByKey.get(key) : undefined);
    },
    [tree, expandedSet, selectedKey, onNodeSelect, rootIndexByKey]
  );

  const canvasClassName = fullscreen
    ? "relative w-full h-[calc(100vh-48px)] overflow-hidden bg-background"
    : "relative w-full h-[600px] rounded-[var(--radius)] border border-primary/20 overflow-hidden bg-background";

  // ── Three-state branch (D-02's single subscription, three-state passthrough) ──

  if (payload === undefined) {
    return (
      <Card className="relative w-full h-[600px] items-center justify-center overflow-hidden">
        <div className="relative h-64 w-64" role="status" aria-label="Loading workspace map">
          {[0, 1, 2].map((ring) => (
            <div
              key={ring}
              className="absolute rounded-full border border-dashed border-muted-foreground/30 animate-pulse"
              style={{ inset: `${ring * 24}px`, animationDelay: `${ring * 150}ms` }}
            />
          ))}
        </div>
      </Card>
    );
  }

  if (payload === null) {
    return (
      <Card className="relative w-full h-[600px] flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm font-semibold">No workspace snapshot yet.</p>
        <p className="max-w-md text-sm text-muted-foreground">
          The nightly scan (04:15) hasn&apos;t produced one. Check{" "}
          <code className="font-mono text-xs">CodePulse-WorkspaceScan</code> in Task Scheduler,
          or wait for the next run.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={fullscreen ? "Exit fullscreen" : "Expand map"}
                onClick={() => setFullscreen((f) => !f)}
              >
                {fullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{fullscreen ? "Exit fullscreen" : "Expand map"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <ForceGraphCanvas
        ref={fgRef}
        data={{ nodes: canvasNodes, links }}
        colorFn={colorFn}
        communityColorFn={communityColorFn}
        labelFn={labelFn}
        defaultNodeColor={colors.mutedForeground}
        defaultLinkColor={colors.primaryAlpha18}
        onNodeClick={handleNodeClick}
        onEngineStop={() => fgRef.current?.zoomToFit(400, 60)}
        cooldownTicks={0}
        className={canvasClassName}
      />
    </div>
  );
}

export default WorkspaceMapCanvas;
