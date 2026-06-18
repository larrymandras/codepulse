/**
 * ForgeFilesPane — file browser + artifact preview pane for a Forge job (Phase 82, FI-12).
 *
 * Mirrors ForgeLogPane structure (loading / empty / container), adapted for the
 * master-detail file browser UI (vertical stack per 82-UI-SPEC Layout).
 *
 * Terminal-state gate (Pitfall 7 / SPEC Req 7): files are only available
 * after a job reaches a terminal status. Running/queued jobs show the
 * "Files appear after the job completes." empty state BEFORE any data fetch.
 * This early return lives in ForgeFilesPane (outer); all hooks are in
 * ForgeFilesPaneContent (inner) so React rules of hooks are satisfied.
 *
 * Workspace rootPath (A7): resolved via useForgeWorkspace(hostId, workspaceId)
 * since ForgeJobRow carries workspaceId but not rootPath directly. Falls back
 * to the workspace prop's rootPath if lookup is unavailable or not provided.
 *
 * SectionErrorBoundary: NOT applied here — applied at the ForgeJobDetail call site
 * so a render failure in this pane does not cascade to Details or Logs tabs (Req 11).
 *
 * Security: filenames rendered as React text nodes via FileBrowser; artifact content
 * rendered via ArtifactPreview (sandboxed iframe / <pre> text node). See those files.
 */

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  useForgeJobFilesRaw,
  useForgeJobArtifact,
  useForgeWorkspace,
  type ForgeFileRow,
} from "@/hooks/useForge";
import { FileBrowser } from "./FileBrowser";
import { ArtifactPreview } from "./ArtifactPreview";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES = ["completed", "failed", "stopped"];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ForgeFilesPaneProps {
  hostId: string;
  forgeJobId: string;
  /** Job status — gates the running-job empty state before any data fetch. */
  jobStatus: string;
  /** Workspace fallback — provides rootPath if workspaceId lookup is unavailable. */
  workspace: { rootPath: string };
  /** workspaceId — used to resolve rootPath via useForgeWorkspace (A7). */
  workspaceId?: string;
}

// ---------------------------------------------------------------------------
// ForgeFilesPane — outer shell with terminal-state gate
// ---------------------------------------------------------------------------

export function ForgeFilesPane({
  hostId,
  forgeJobId,
  jobStatus,
  workspace,
  workspaceId,
}: ForgeFilesPaneProps) {
  // TERMINAL-STATE GATE (Pitfall 7 / SPEC Req 7):
  // Return early BEFORE ForgeFilesPaneContent mounts (and before any hooks fire).
  // Files only exist after a job reaches a terminal state; running/queued jobs
  // show a holding empty state so no query is dispatched unnecessarily.
  if (!TERMINAL_STATUSES.includes(jobStatus)) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 py-8 px-4 text-center">
        <p className="text-sm text-muted-foreground">
          Files appear after the job completes.
        </p>
      </div>
    );
  }

  return (
    <ForgeFilesPaneContent
      hostId={hostId}
      forgeJobId={forgeJobId}
      workspace={workspace}
      workspaceId={workspaceId}
    />
  );
}

// ---------------------------------------------------------------------------
// ForgeFilesPaneContent — rendered only after terminal-state gate passes.
// All hooks are called unconditionally here (React rules of hooks compliant).
// ---------------------------------------------------------------------------

interface ForgeFilesPaneContentProps {
  hostId: string;
  forgeJobId: string;
  workspace: { rootPath: string };
  workspaceId?: string;
}

function ForgeFilesPaneContent({
  hostId,
  forgeJobId,
  workspace,
  workspaceId,
}: ForgeFilesPaneContentProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  // A7: Resolve rootPath via workspaceId lookup.
  // useForgeWorkspace returns undefined while loading, null if not found,
  // or { rootPath } when resolved. Falls back to workspace.rootPath.
  const resolvedWs = useForgeWorkspace(
    workspaceId ? hostId : null,
    workspaceId ?? null
  );
  const rootPath = resolvedWs?.rootPath ?? workspace.rootPath;

  // File listing — returns undefined (loading), [] (empty), or ForgeFileRow[].
  // useForgeJobFilesRaw distinguishes loading from empty (unlike useForgeJobFiles).
  const files = useForgeJobFilesRaw(hostId, forgeJobId);

  // Artifact for selected file — returns undefined (loading), null (not found),
  // or a ForgeArtifactRow with textContent/imageUrl populated.
  const artifactData = useForgeJobArtifact(
    selectedPath ? hostId : null,
    selectedPath ? forgeJobId : null,
    selectedPath
  );

  // Build the selected file metadata from the files list
  const selectedFile: ForgeFileRow | null =
    selectedPath && files
      ? (files.find((f) => f.path === selectedPath) ?? null)
      : null;

  // ---------------------------------------------------------------------------
  // Loading state — query still pending (files === undefined)
  // ---------------------------------------------------------------------------
  if (files === undefined) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading files…
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Zero-files empty state (terminal job, no files ingested)
  // ---------------------------------------------------------------------------
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 py-8 px-4 text-center">
        <p className="text-sm text-muted-foreground">No files found for this job.</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Master-detail stack: FileBrowser (top) + ArtifactPreview (bottom)
  // ---------------------------------------------------------------------------

  // Resolve artifact display props — only when a file is selected and artifact
  // data has loaded (not undefined). Use "any" cast since ForgeArtifactRow
  // fields are typed per the backend response shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const artifactRecord = artifactData as any;
  const showArtifact = selectedFile !== null && artifactData !== undefined;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* FileBrowser — top pane: min-h 160px, up to 40% of panel, scrollable */}
      <div className="flex-none min-h-[160px] max-h-[40%] overflow-y-auto border-b border-border">
        <FileBrowser
          files={files}
          workspace={{ rootPath }}
          selectedPath={selectedPath ?? undefined}
          onSelectFile={(entry) => setSelectedPath(entry.path)}
        />
      </div>

      {/* ArtifactPreview — bottom pane: fills remaining height */}
      <div className="flex-1 overflow-hidden">
        {showArtifact ? (
          <ArtifactPreview
            textContent={artifactRecord?.textContent as string | undefined}
            imageUrl={artifactRecord?.imageUrl as string | null | undefined}
            fileKind={selectedFile.kind}
            sizeBytes={selectedFile.sizeBytes}
            rootPath={rootPath}
            filePath={selectedFile.path}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Select a file to preview
          </div>
        )}
      </div>
    </div>
  );
}
