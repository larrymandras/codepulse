/**
 * ForgeMetadataPanel — 13-field metadata grid for a Forge job (D-02).
 *
 * Two-column CSS grid grouped into: Identity / Execution / Resources /
 * Configuration / Audit. Renders inside a GlassPanel. No action controls.
 *
 * Security: all field values rendered as JSX text children only.
 * No dangerouslySetInnerHTML. JSON.parse of capabilities wrapped in try/catch.
 */

import { GlassPanel } from "@/components/GlassPanel";
import { ForgeStatusBadge } from "./ForgeStatusBadge";
import type { ForgeJobRow } from "@/hooks/useForge";

interface ForgeMetadataPanelProps {
  job: ForgeJobRow;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function formatNullableNumber(n: number | null): string {
  if (n === null) return "—";
  return String(n);
}

function formatWorkspaceId(id: string): string {
  return id.length > 12 ? id.slice(0, 12) + "…" : id;
}

function formatModel(model: string | null): string {
  return model ?? "default";
}

function formatCapabilities(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(parsed)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join("\n");
  } catch {
    return raw;
  }
}

// ---------------------------------------------------------------------------
// Group divider component (lighter weight than SectionHeader)
// ---------------------------------------------------------------------------

function GroupDivider({ label }: { label: string }) {
  return (
    <>
      <dt className="col-span-2 border-t border-border mt-1" />
      <dd className="col-span-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground pb-1">
        {label}
      </dd>
    </>
  );
}

// ---------------------------------------------------------------------------
// ForgeMetadataPanel
// ---------------------------------------------------------------------------

export function ForgeMetadataPanel({ job }: ForgeMetadataPanelProps) {
  return (
    <GlassPanel className="m-0 rounded-none border-0 h-full">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-4 py-3">

        {/* ── Identity ── */}
        <dt className="col-span-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground pb-1">
          Identity
        </dt>

        <dt className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Agent
        </dt>
        <dd className="text-xs text-foreground capitalize">{job.agent}</dd>

        <dt className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Mode
        </dt>
        <dd className="text-xs text-foreground capitalize">{job.mode}</dd>

        <dt className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Status
        </dt>
        <dd className="text-xs text-foreground">
          <ForgeStatusBadge status={job.status} />
        </dd>

        {/* ── Execution ── */}
        <GroupDivider label="Execution" />

        <dt className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          PID
        </dt>
        <dd className="text-xs text-foreground">{formatNullableNumber(job.pid)}</dd>

        <dt className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Exit Code
        </dt>
        <dd className="text-xs text-foreground">{formatNullableNumber(job.exitCode)}</dd>

        <dt className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Started At
        </dt>
        <dd className="text-xs text-foreground">{formatDateTime(job.startedAt)}</dd>

        <dt className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Finished At
        </dt>
        <dd className="text-xs text-foreground">{formatDateTime(job.finishedAt)}</dd>

        {/* ── Resources ── */}
        <GroupDivider label="Resources" />

        <dt className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Workspace ID
        </dt>
        <dd className="text-xs text-foreground">{formatWorkspaceId(job.workspaceId)}</dd>

        <dt className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Artifact Count
        </dt>
        <dd className="text-xs text-foreground">{job.artifactCount}</dd>

        {/* ── Configuration ── */}
        <GroupDivider label="Configuration" />

        <dt className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Model
        </dt>
        <dd className="text-xs text-foreground">{formatModel(job.model)}</dd>

        <dt className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Capabilities
        </dt>
        <dd className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
          {formatCapabilities(job.capabilities)}
        </dd>

        {/* ── Audit ── */}
        <GroupDivider label="Audit" />

        <dt className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Created At
        </dt>
        <dd className="text-xs text-foreground">{formatDateTime(job.createdAt)}</dd>

        <dt className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Updated At
        </dt>
        <dd className="text-xs text-foreground">{formatDateTime(job.updatedAt)}</dd>

      </dl>
    </GlassPanel>
  );
}
