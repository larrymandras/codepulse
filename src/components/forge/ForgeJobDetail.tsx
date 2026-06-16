/**
 * ForgeJobDetail — job header + metadata panel (D-01/D-02).
 *
 * Port of forge JobDetail.tsx with all action controls and tab machinery stripped:
 * - REMOVED: isStopping state, handleStop, Stop Job Button
 * - REMOVED: Tabs/TabsList/TabsTrigger/TabsContent, LogsPanel, FilesPanel
 * - REMOVED: useJobLog, useWorkspaceFiles, useWorkspaces, apiFetch imports
 * - REMOVED: InlineStatusBadge (replaced by ForgeStatusBadge)
 * - REMOVED: onStopped prop
 *
 * What remains: header (agent + status badge + prompt) + ForgeMetadataPanel.
 * No-selection state: "Select a job to view details" (ported from forge, already neutral).
 *
 * Security: job.agent and job.prompt rendered as JSX text children only.
 */

import { ForgeStatusBadge } from "./ForgeStatusBadge";
import { ForgeMetadataPanel } from "./ForgeMetadataPanel";
import type { ForgeJobRow } from "@/hooks/useForge";

// ---------------------------------------------------------------------------
// Prop interface
// ---------------------------------------------------------------------------

interface ForgeJobDetailProps {
  job: ForgeJobRow | null;
}

// ---------------------------------------------------------------------------
// ForgeJobDetail
// ---------------------------------------------------------------------------

export function ForgeJobDetail({ job }: ForgeJobDetailProps) {
  // No-selection empty state (ported from forge JobDetail.tsx line 205)
  if (!job) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Select a job to view details
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header: agent name + status badge + prompt */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
        <span className="text-sm font-semibold text-foreground">{job.agent}</span>
        <ForgeStatusBadge status={job.status} />
        {job.prompt && (
          <span className="flex-1 text-xs text-muted-foreground truncate">
            {job.prompt}
          </span>
        )}
      </div>

      {/* Metadata panel — scrollable below the header */}
      <div className="flex-1 overflow-y-auto">
        <ForgeMetadataPanel job={job} />
      </div>
    </div>
  );
}
