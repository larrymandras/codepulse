/**
 * ForgePage — Phase 79 Plan 03.
 *
 * Master-detail layout: ForgeJobList (left, ~280px) + ForgeJobDetail (right, flex-1).
 * Selection keyed on (hostId, forgeJobId) pair (D-11, D-03).
 * Detail renders from the already-loaded listJobs row — NO getJob round-trip.
 * Both list and detail regions wrapped in their own SectionErrorBoundary.
 */

import { useState } from "react";
import { useForgeJobsRaw } from "@/hooks/useForge";
import { ForgeJobList } from "@/components/forge/ForgeJobList";
import { ForgeJobDetail } from "@/components/forge/ForgeJobDetail";
import { GlassPanel } from "@/components/GlassPanel";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";

export default function ForgePage() {
  // Raw value distinguishes loading (undefined) from empty ([])
  const raw = useForgeJobsRaw();
  const jobs = raw ?? [];
  const isLoading = raw === undefined;

  // Selection state: (hostId, forgeJobId) pair (D-11 — merged multi-host list)
  const [selectedKey, setSelectedKey] = useState<{
    hostId: string;
    forgeJobId: string;
  } | null>(null);

  // Derive the selected job from the already-loaded list row (no getJob call)
  const selectedJob =
    selectedKey
      ? (jobs.find(
          (j) =>
            j.hostId === selectedKey.hostId && j.id === selectedKey.forgeJobId
        ) ?? null)
      : null;

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-4">
      {/* Page header — standard CodePulse pattern (BuildProgress.tsx:24) */}
      <h1 className="text-2xl font-bold text-foreground shrink-0">Forge</h1>

      {/* Master-detail body — GlassPanel wraps the list+detail row (D-11) */}
      <GlassPanel className="flex-1 flex overflow-hidden min-h-0">
        {/* List panel — fixed ~280px, scrollable (D-11) */}
        <div className="w-[280px] shrink-0 border-r border-border overflow-hidden">
          <SectionErrorBoundary name="Forge Job List">
            <ForgeJobList
              jobs={jobs}
              loading={isLoading}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
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
    </div>
  );
}
