/**
 * IntakeStatusBadge — RowStatusBadge, SeverityBadge, VerdictBadge,
 * DestinationBadge chip family for the CodePulse Intake panel/modal.
 *
 * Ports ForgeStatusBadge.tsx's STATUS_MAP + defensive-fallback + chip-shape
 * discipline 1:1, four times over (07-UI-SPEC.md § Status/severity/verdict
 * color table is authoritative for every value below).
 *
 * severity/verdict/destination deliberately accept a raw untyped-at-the-
 * boundary string (not a narrow union): this content ultimately originates
 * from a report a hostile SKILL.md can influence indirectly (an unexpected
 * rule-registry change, a future schema addition), and the defensive-
 * fallback discipline is the actual safety net, not TypeScript's type system.
 */

import {
  Loader2,
  Clock,
  XCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  Circle,
  Globe,
  FolderGit2,
  Archive,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { IntakeRowStatus } from "@/hooks/useIntake";

interface StatusConfig {
  label: string;
  className: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const NEUTRAL_FALLBACK: Omit<StatusConfig, "label"> = {
  className: "bg-zinc-800/60 text-zinc-400",
  Icon: Circle,
};

// ---------------------------------------------------------------------------
// RowStatusBadge — never render for status === "done": the UI-SPEC table is
// explicit that a done row shows the verdict badge instead, not a separate
// "done" chip. Enforced by typing status as Exclude<IntakeRowStatus, "done">
// so a caller passing "done" is a type error, not a silent wrong-chip render.
// ---------------------------------------------------------------------------

type RowStatusKey = Exclude<IntakeRowStatus, "done">;

interface RowStatusBadgeProps {
  status: RowStatusKey;
  /**
   * Live "Expires in {m:ss}" countdown string for a queued row, passed by
   * Plan 07-02's IntakePanel. This component never owns the timer itself —
   * pure presentation.
   */
  countdownLabel?: string;
}

export function RowStatusBadge({ status, countdownLabel }: RowStatusBadgeProps) {
  const ROW_STATUS_MAP: Record<RowStatusKey, StatusConfig> = {
    pending: {
      label: "Queued…",
      className: "bg-zinc-800/60 text-primary",
      Icon: Loader2,
    },
    queued: {
      label: countdownLabel ?? "Queued",
      className: "bg-zinc-800/60 text-zinc-400",
      Icon: Clock,
    },
    // Claude's Discretion — UI-SPEC's color table has no explicit "executing"
    // row since no daemon exists yet to produce this state in dev; reuses
    // the existing --status-info token, matching ForgeStatusBadge's
    // "running" treatment.
    executing: {
      label: "Executing…",
      className: "bg-blue-900/60 text-[var(--status-info)]",
      Icon: Loader2,
    },
    failed: {
      label: "Failed",
      className: "bg-red-900/60 text-[var(--status-error)]",
      Icon: XCircle,
    },
    expired: {
      label: "Expired",
      className: "bg-zinc-800/30 text-zinc-600",
      Icon: Clock,
    },
  };

  const config: StatusConfig =
    (ROW_STATUS_MAP[status] as StatusConfig | undefined) ?? {
      label: status || "Unknown",
      ...NEUTRAL_FALLBACK,
    };

  const spin = status === "pending" || status === "executing";

  return (
    <span
      aria-label={status}
      data-status={status}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold ${config.className}`}
    >
      <config.Icon className={`h-3 w-3${spin ? " animate-spin" : ""}`} />
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// SeverityBadge
// ---------------------------------------------------------------------------

const SEVERITY_MAP: Record<string, StatusConfig> = {
  error: {
    label: "Error",
    className: "bg-red-900/60 text-[var(--status-error)]",
    Icon: XCircle,
  },
  warning: {
    label: "Warning",
    className: "bg-amber-900/60 text-[var(--status-warn)]",
    Icon: AlertTriangle,
  },
  info: {
    label: "Info",
    className: "bg-blue-900/60 text-[var(--status-info)]",
    Icon: Info,
  },
};

interface SeverityBadgeProps {
  severity: string;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const config: StatusConfig =
    (SEVERITY_MAP[severity] as StatusConfig | undefined) ?? {
      label: severity || "Unknown",
      ...NEUTRAL_FALLBACK,
    };

  return (
    <span
      aria-label={severity}
      data-status={severity}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold ${config.className}`}
    >
      <config.Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// VerdictBadge
// ---------------------------------------------------------------------------

const VERDICT_MAP: Record<string, StatusConfig> = {
  admit: {
    label: "Admit",
    className: "bg-green-900/60 text-[var(--status-ok)]",
    Icon: CheckCircle,
  },
  reject: {
    label: "Reject",
    className: "bg-red-900/60 text-[var(--status-error)]",
    Icon: XCircle,
  },
  error: {
    label: "Error",
    className: "bg-amber-900/60 text-[var(--status-warn)]",
    Icon: AlertTriangle,
  },
};

interface VerdictBadgeProps {
  verdict: string;
}

export function VerdictBadge({ verdict }: VerdictBadgeProps) {
  const config: StatusConfig =
    (VERDICT_MAP[verdict] as StatusConfig | undefined) ?? {
      label: verdict || "Unknown",
      ...NEUTRAL_FALLBACK,
    };

  return (
    <span
      aria-label={verdict}
      data-status={verdict}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold ${config.className}`}
    >
      <config.Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// DestinationBadge — informational, never colored; wraps the shadcn Badge
// component directly (variant="outline"), per UI-SPEC's "neutral Badge
// variant outline" instruction.
// ---------------------------------------------------------------------------

interface DestinationConfig {
  label: string;
  Icon?: React.ComponentType<{ className?: string }>;
}

const DESTINATION_MAP: Record<string, DestinationConfig> = {
  global: { label: "Global", Icon: Globe },
  project: { label: "Project", Icon: FolderGit2 },
  cold: { label: "Cold storage", Icon: Archive },
};

interface DestinationBadgeProps {
  destination: string;
}

export function DestinationBadge({ destination }: DestinationBadgeProps) {
  const config = DESTINATION_MAP[destination];

  // UI-SPEC's chip shape (inline-flex items-center gap-1 rounded-full
  // px-2.5 py-0.5 text-sm font-semibold) applies uniformly across the chip
  // family, merged onto the shadcn Badge's own variant="outline" classes via
  // cn()/tailwind-merge (later classes win on conflicting utilities).
  if (!config) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold",
          "border-border text-foreground"
        )}
        aria-label={destination}
        data-status={destination}
      >
        {destination}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold",
        "border-border text-foreground"
      )}
      aria-label={destination}
      data-status={destination}
    >
      {config.Icon ? <config.Icon className="h-3 w-3" /> : null}
      {config.label}
    </Badge>
  );
}
