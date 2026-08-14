/**
 * WorkspaceMap — the `/workspace-map` page (plan 114-10).
 *
 * Composes the two D-10 lenses behind a single workspace-map subscription
 * (D-02 — never call the hook twice for the same 1.35 MB payload) and
 * a closed-set `?lens=` URL param (D-12): an absent, empty, or unrecognized
 * value all resolve to `"workspace"`. The raw param string is never rendered
 * or interpolated anywhere in this file — it is only ever compared against
 * the literal `"astridr"`.
 *
 * Two independent `SectionErrorBoundary`s (`CLAUDE.md` § Patterns, T-114-18):
 * a render fault in the coverage strip must not blank the canvas, and vice
 * versa. An unhandled `useQuery` throw unmounts the whole React tree
 * (recorded twice already — Phase 110's `/analytics` incident and the
 * `heroStats` incident) — that is exactly what these two boundaries prevent.
 */

import { useCallback, useState } from "react";
import { useSearchParams } from "react-router";
import { Radar } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import { useWorkspaceMap } from "@/hooks/useWorkspaceMap";
import { useArmsProbe } from "@/hooks/useArmsProbe";
import { WorkspaceCoverageStrip } from "@/components/workspace/WorkspaceCoverageStrip";
import { WorkspaceMapCanvas } from "@/components/workspace/WorkspaceMapCanvas";
import { WorkspaceMapPanel } from "@/components/workspace/WorkspaceMapPanel";
import { AstridrLensEmptyState } from "@/components/workspace/AstridrLensEmptyState";
import type { WorkspaceMapNodeSelectHandler } from "@/components/workspace/WorkspaceMapCanvas";
import type { WorkspaceMapNode } from "@/lib/workspaceMapLayout";

// ---------------------------------------------------------------------------
// Lens derivation — closed-set default (D-12). The raw searchParams value is
// deliberately never read again below this line.
// ---------------------------------------------------------------------------

type Lens = "workspace" | "astridr";

function deriveLens(rawLensParam: string | null): Lens {
  return rawLensParam === "astridr" ? "astridr" : "workspace";
}

export default function WorkspaceMap() {
  const [searchParams, setSearchParams] = useSearchParams();
  const lens = deriveLens(searchParams.get("lens"));

  const payload = useWorkspaceMap();
  const armsPresent = useArmsProbe();

  const [selectedNode, setSelectedNode] = useState<WorkspaceMapNode | null>(null);
  const [selectedRootIndex, setSelectedRootIndex] = useState<number | undefined>(undefined);
  const [panelOpen, setPanelOpen] = useState(false);

  const setLens = useCallback(
    (next: Lens) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.set("lens", next);
        return params;
      });
    },
    [setSearchParams]
  );

  const handleNodeSelect: WorkspaceMapNodeSelectHandler = useCallback((node, rootIndex) => {
    setSelectedNode(node);
    setSelectedRootIndex(rootIndex);
    setPanelOpen(node !== null);
  }, []);

  return (
    <div className="p-6">
      <PageHeader title="Workspace Map" icon={Radar} />

      <Tabs
        value={lens}
        onValueChange={(value) => setLens(value === "astridr" ? "astridr" : "workspace")}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="astridr">Ástríðr</TabsTrigger>
        </TabsList>
      </Tabs>

      {lens === "workspace" ? (
        <div className="flex flex-col gap-8">
          <SectionErrorBoundary name="Workspace Coverage Strip">
            {/* No `?? undefined` here. Collapsing null (no snapshot) into
                undefined (loading) made the strip show a loading skeleton
                forever on a first run — CR-01, Phase 114 code review. The
                strip branches on all three states itself. */}
            <WorkspaceCoverageStrip data={payload} />
          </SectionErrorBoundary>
          <SectionErrorBoundary name="Workspace Map Canvas">
            <WorkspaceMapCanvas payload={payload} onNodeSelect={handleNodeSelect} />
          </SectionErrorBoundary>
        </div>
      ) : (
        <AstridrLensEmptyState
          armsPresent={armsPresent}
          onSwitchToWorkspace={() => setLens("workspace")}
        />
      )}

      <WorkspaceMapPanel
        node={selectedNode}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        rootIndex={selectedRootIndex}
      />
    </div>
  );
}
