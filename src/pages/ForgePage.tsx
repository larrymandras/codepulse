/**
 * ForgePage — Phase 79 master-detail + Phase 80 launch wiring.
 *
 * Master-detail layout: ForgeJobList (left, ~280px) + ForgeJobDetail (right, flex-1).
 * Selection keyed on (hostId, forgeJobId) pair (D-11, D-03).
 * Detail renders from the already-loaded listJobs row — NO getJob round-trip.
 * Both list and detail regions wrapped in their own SectionErrorBoundary.
 *
 * Phase 80 additions (layout UNCHANGED — modal is an overlay):
 * - Launch modal trigger + ForgeLaunchModal overlay (FI-07).
 * - B2 optimism: ForgePage owns local `pendingLocal` state for the optimistic
 *   "Queued" row (D-10) and its Failed flip (D-11), merged with the server
 *   `listForgeCommands` rows and deduped by commandId. A reconciliation effect
 *   drops a local row once its resolvedForgeJobId appears in `jobs`.
 * - Clerk-gated Launch button (FI-08): isAuthenticated defaults to false
 *   (fail-closed). W2 — useUser() throws without a ClerkProvider, so it is only
 *   called inside ClerkAuthProbe, which is mounted ONLY when Clerk is configured
 *   (mirrors AuthGuard's VITE_CLERK_PUBLISHABLE_KEY gate).
 */

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import {
  useForgeJobsRaw,
  useForgeCommands,
  type ForgeCommandRow,
  type ForgeJobRow,
} from "@/hooks/useForge";
import { ForgeJobList } from "@/components/forge/ForgeJobList";
import { ForgeJobDetail } from "@/components/forge/ForgeJobDetail";
import { ForgeLaunchModal } from "@/components/forge/ForgeLaunchModal";
import { GlassPanel } from "@/components/GlassPanel";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

/**
 * ClerkAuthProbe — reports Clerk auth state up via onChange. Mounted ONLY when
 * Clerk is configured, because useUser() throws outside a <ClerkProvider/> (W2).
 */
function ClerkAuthProbe({
  onChange,
}: {
  onChange: (isAuthenticated: boolean) => void;
}) {
  const { user } = useUser();
  const authed = user != null;
  useEffect(() => {
    onChange(authed);
  }, [authed, onChange]);
  return null;
}

/** Dedupe pending rows by commandId — the local optimistic row wins. */
function dedupeByCommandId(rows: ForgeCommandRow[]): ForgeCommandRow[] {
  const seen = new Set<string>();
  const out: ForgeCommandRow[] = [];
  for (const row of rows) {
    if (seen.has(row.commandId)) continue;
    seen.add(row.commandId);
    out.push(row);
  }
  return out;
}

/**
 * isReconciled — a pending row should be dropped once its resolved real job
 * exists in `jobs`. We look up the authoritative resolvedForgeJobId from the
 * matching server command (the local row may not have it yet).
 */
function isReconciled(
  row: ForgeCommandRow,
  serverCommands: ForgeCommandRow[],
  jobs: ForgeJobRow[]
): boolean {
  const server = serverCommands.find((c) => c.commandId === row.commandId);
  const resolved = server?.resolvedForgeJobId ?? row.resolvedForgeJobId;
  if (resolved == null) return false;
  return jobs.some((j) => j.id === resolved);
}

export default function ForgePage() {
  // Raw value distinguishes loading (undefined) from empty ([])
  const raw = useForgeJobsRaw();
  // Stable identity: `raw ?? []` allocates a fresh [] while loading, which would
  // churn the reconcile effect (deps [jobs, serverCommands]) into an infinite loop.
  const jobs = useMemo(() => raw ?? [], [raw]);
  const isLoading = raw === undefined;

  // Server-side command rows (all hosts — cache key {})
  const { commands: serverCommands } = useForgeCommands(null);

  // B2 — local optimistic state owns the immediate Queued row (D-10/D-11)
  const [pendingLocal, setPendingLocal] = useState<ForgeCommandRow[]>([]);

  // Launch modal + Clerk auth (fail-closed default)
  const [launchModalOpen, setLaunchModalOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Selection state: (hostId, forgeJobId) pair (D-11 — merged multi-host list)
  const [selectedKey, setSelectedKey] = useState<{
    hostId: string;
    forgeJobId: string;
  } | null>(null);

  // Optimistic-row callbacks passed to the modal
  const handleLaunched = (row: ForgeCommandRow) =>
    setPendingLocal((prev) => [row, ...prev]);
  const handleLaunchFailed = (commandId: string, message: string) =>
    setPendingLocal((prev) =>
      prev.map((r) =>
        r.commandId === commandId
          ? { ...r, status: "failed", error: message }
          : r
      )
    );

  // Reconciliation cleanup: drop local rows whose real forgeJobs row now exists.
  useEffect(() => {
    setPendingLocal((prev) =>
      prev.filter((r) => !isReconciled(r, serverCommands, jobs))
    );
  }, [jobs, serverCommands]);

  // Merge for display — local row wins on commandId collision once echoed back.
  const pendingCommands = dedupeByCommandId([
    ...pendingLocal,
    ...serverCommands,
  ]);

  // Derive the selected job from the already-loaded list row (no getJob call)
  const selectedJob = selectedKey
    ? (jobs.find(
        (j) =>
          j.hostId === selectedKey.hostId && j.id === selectedKey.forgeJobId
      ) ?? null)
    : null;

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-4">
      {/* W2 — only probe Clerk when configured; otherwise isAuthenticated stays false */}
      {CLERK_KEY && <ClerkAuthProbe onChange={setIsAuthenticated} />}

      {/* Page header — standard CodePulse pattern (BuildProgress.tsx:24) */}
      <h1 className="text-2xl font-bold text-foreground shrink-0">Forge</h1>

      {/* Master-detail body — GlassPanel wraps the list+detail row (D-11) */}
      <GlassPanel className="flex-1 flex overflow-hidden min-h-0">
        {/* List panel — fixed ~280px, scrollable (D-11) */}
        <div className="w-[280px] shrink-0 border-r border-border overflow-hidden">
          <SectionErrorBoundary name="Forge Job List">
            <ForgeJobList
              jobs={jobs}
              pendingCommands={pendingCommands}
              loading={isLoading}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
              onLaunchClick={() => setLaunchModalOpen(true)}
              isAuthenticated={isAuthenticated}
            />
          </SectionErrorBoundary>
        </div>

        {/* Detail panel — flex-1 */}
        <div className="flex-1 overflow-hidden">
          <SectionErrorBoundary name="Forge Job Detail">
            <ForgeJobDetail job={selectedJob} />
          </SectionErrorBoundary>
        </div>
      </GlassPanel>

      {/* Launch modal overlay (FI-07) — does not affect layout */}
      <ForgeLaunchModal
        open={launchModalOpen}
        onClose={() => setLaunchModalOpen(false)}
        onLaunched={handleLaunched}
        onLaunchFailed={handleLaunchFailed}
      />
    </div>
  );
}
