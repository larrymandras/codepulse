/**
 * ForgeJobDetail — job header + metadata panel (Phase 79 base + Phase 80 Stop wiring).
 *
 * Phase 79 (base): header (agent + status badge + prompt) + ForgeMetadataPanel.
 * No-selection state: "Select a job to view details" (ported from forge, already neutral).
 *
 * Phase 80 additions (D-03/D-04, FI-07):
 * - Stop button (ForgeStopConfirmDialog) rendered ONLY when job.status === "running"
 * - Local isStoppingLocal state: flips to true after confirm, stays until terminal status
 * - enqueueStop mutation call (Clerk fail-closed server-side, D-13)
 * - useEffect clears isStoppingLocal when status transitions away from "running"
 * - No optimistic terminal flip on forgeJobs status badge (D-04/Pitfall 2)
 * - Pending job detail pane (for optimistic "Queued" command rows from 80-03)
 *
 * Security: job.agent and job.prompt rendered as JSX text children only.
 *
 * IMPORTANT: There is NO setQuery(api.forge.listJobs ... status:"stopped") call here.
 * The badge updates solely when the reactive query delivers the real terminal status.
 */

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { ForgeStatusBadge } from "./ForgeStatusBadge";
import { ForgeMetadataPanel } from "./ForgeMetadataPanel";
import { ForgeStopConfirmDialog } from "./ForgeStopConfirmDialog";
import { ForgeLogPane } from "./ForgeLogPane";
import { ForgeFilesPane } from "./ForgeFilesPane";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import type { ForgeJobRow, JobStatus } from "@/hooks/useForge";

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
  // Local stopping state — D-04: only the button reflects this; forgeJobs badge
  // does NOT change optimistically. It stays "Stopping…" until the reactive
  // listJobs query delivers a terminal status (stopped / failed / completed).
  const [isStoppingLocal, setIsStoppingLocal] = useState(false);

  // Details/Logs/Files tab — default to "details" so existing behavior is preserved.
  type DetailTab = "details" | "logs" | "files";
  const [activeTab, setActiveTab] = useState<DetailTab>("details");

  const enqueueStop = useMutation(api.forge.enqueueStop);

  // Clear local stopping state when the job transitions away from "running"
  // (reactive query delivered the terminal status — or the job was never running).
  useEffect(() => {
    if (job?.status !== "running") {
      setIsStoppingLocal(false);
    }
  }, [job?.status]);

  const handleConfirmedStop = async () => {
    if (!job) return;
    // D-04: Only the button goes to "Stopping…" — do NOT optimistically patch
    // the forgeJobs status badge. No setQuery / optimistic terminal flip here.
    setIsStoppingLocal(true);
    try {
      await enqueueStop({
        hostId: job.hostId,
        forgeJobId: job.id,
        commandId: crypto.randomUUID(),
      });
      // Do NOT reset isStoppingLocal on success — it stays "Stopping…" until the
      // reactive query delivers status:"stopped" and the Stop button disappears.
    } catch (err) {
      // Reset so the button re-enables after a failed mutation
      setIsStoppingLocal(false);
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to stop job: ${message}`);
    }
  };

  // ---------------------------------------------------------------------------
  // No-selection empty state (ported from forge JobDetail.tsx line 205)
  // ---------------------------------------------------------------------------

  if (!job) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Select a job to view details
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Pending job detail pane (D-10 — optimistic command row selected)
  // ForgeCommandRow rows are passed in as ForgeJobRow with status="pending"|"expired"
  // and no real forgeJobs metadata. We branch on a status sentinel rather than
  // a _type discriminant to keep prop compatibility with ForgeJobRow.
  // ---------------------------------------------------------------------------

  const isPendingRow =
    job.status === "pending" || job.status === "expired" || job.status === "failed";
  const hasNoRealMetadata = !job.startedAt && !job.exitCode && job.artifactCount === 0;

  if (isPendingRow && hasNoRealMetadata && !job.pid) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
          <ForgeStatusBadge status={job.status as JobStatus} />
        </div>
        <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground">
          {job.status === "failed"
            ? `Command failed: ${job.prompt ?? "unknown error"}`
            : job.status === "expired"
              ? `Command expired — daemon was offline.`
              : `Queued — waiting for Forge daemon on ${job.hostId}…`}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Normal job detail — header + metadata
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header: agent name + status badge + prompt + Stop button (running only) */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
        <span className="text-sm font-semibold text-foreground">{job.agent}</span>
        <ForgeStatusBadge status={job.status} />
        {job.prompt && (
          <span className="flex-1 text-xs text-muted-foreground truncate">
            {job.prompt}
          </span>
        )}
        {/* D-03/D-04: Stop button — only for running jobs; hidden on terminal states.
            Pitfall 2: ForgeStopConfirmDialog receives isStoppingLocal (local button state)
            NOT a derived forgeJobs status. The badge on the left does NOT flip here. */}
        {job.status === "running" && (
          <ForgeStopConfirmDialog
            jobId={job.id}
            hostId={job.hostId}
            isStopping={isStoppingLocal}
            onConfirmedStop={handleConfirmedStop}
          />
        )}
      </div>

      {/* Details / Logs tab strip */}
      <div className="flex gap-0 border-b border-border shrink-0 px-4">
        <button
          onClick={() => setActiveTab("details")}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "details"
              ? "border-emerald-500 text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Details
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "logs"
              ? "border-emerald-500 text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Logs
        </button>
        <button
          onClick={() => setActiveTab("files")}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "files"
              ? "border-emerald-500 text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Files
        </button>
      </div>

      {/* Tab body — Details: ForgeMetadataPanel; Logs: ForgeLogPane; Files: ForgeFilesPane */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "details" ? (
          <div className="h-full overflow-y-auto">
            <ForgeMetadataPanel job={job} />
          </div>
        ) : activeTab === "logs" ? (
          <ForgeLogPane hostId={job.hostId} forgeJobId={job.id} />
        ) : (
          <SectionErrorBoundary name="Files">
            <ForgeFilesPane
              hostId={job.hostId}
              forgeJobId={job.id}
              jobStatus={job.status}
              workspace={{ rootPath: "" }}
              workspaceId={job.workspaceId}
            />
          </SectionErrorBoundary>
        )}
      </div>
    </div>
  );
}
