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
 *
 * D-07 (Phase 122) badge law: three entries move to the Strong (filled,
 * opaque) tier because they are the same "needs operator action" category
 * D-07 names for `failed`/`regression`/`rejected verification` —
 * `ROW_STATUS_MAP.failed`, `SEVERITY_MAP.error` (a finding classified
 * error-severity) and `VERDICT_MAP.reject` (a rejected verification, in
 * this vocabulary's own words). `VERDICT_MAP.admit` moves to Quietest — a
 * definitive positive terminal outcome, the same bucket as job `completed`/
 * swarm `done`. `ROW_STATUS_MAP.expired` and the shared `NEUTRAL_FALLBACK`
 * also move to Quietest (administrative/inactive). Everything else keeps
 * its existing low-opacity-fill "Quiet but unmistakable" idiom, detokenized
 * off `zinc` where it still used the raw palette (TOKEN-01, 122's corpus
 * census). Full per-entry reasoning: 122-BADGE-LAW.md §4.
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

// D-07 Quietest tier: flat, no colour. Detokenized from zinc; matches the
// same fallback idiom StatusBadge.tsx and ForgeStatusBadge.tsx use for an
// unrecognised status.
const NEUTRAL_FALLBACK: Omit<StatusConfig, "label"> = {
  className: "bg-muted text-muted-foreground",
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

// Hoisted to module scope (review #8): only the queued row's countdown label
// is runtime-dependent (overridden per-render below); everything else is
// static, so rebuilding this whole map inside the component body on every
// render — × every row × the 1 Hz countdown tick — was pure allocation churn.
const ROW_STATUS_MAP: Record<RowStatusKey, StatusConfig> = {
  // D-07 Quiet tier (parallels job/Forge `pending`). Detokenized: zinc-800
  // -> bg-muted; text-primary kept (already token-driven).
  pending: {
    label: "Queued…",
    className: "bg-muted text-primary",
    Icon: Loader2,
  },
  // D-07 Quiet tier (parallels job/Forge `queued`). A border is added so
  // Quiet is visually distinct from the flat Quietest tier below (same
  // shape decision as StatusBadge.tsx's own `queued` entry).
  queued: {
    label: "Queued",
    className: "border border-border text-muted-foreground bg-transparent",
    Icon: Clock,
  },
  // Claude's Discretion — UI-SPEC's color table has no explicit "executing"
  // row since no daemon exists yet to produce this state in dev; reuses
  // the existing --status-info token, matching ForgeStatusBadge's
  // "running" treatment. D-07 Quiet tier (parallels `running`).
  executing: {
    label: "Executing…",
    className: "bg-[var(--status-info)]/20 text-[var(--status-info)]",
    Icon: Loader2,
  },
  // D-07 Strong tier: `failed` is named directly. Opaque fill, matching
  // Forge's corrected pairing.
  failed: {
    label: "Failed",
    className: "bg-[var(--status-error-fill)] text-[var(--status-error-on-fill)]",
    Icon: XCircle,
  },
  // D-07 Quietest tier (administrative/inactive terminal state, parallels
  // Forge `expired`). Detokenized and flattened: zinc-800/30 -> flat
  // bg-muted/text-muted-foreground.
  expired: {
    label: "Expired",
    className: "bg-muted text-muted-foreground",
    Icon: Clock,
  },
};

export function RowStatusBadge({ status, countdownLabel }: RowStatusBadgeProps) {
  const base: StatusConfig =
    (ROW_STATUS_MAP[status] as StatusConfig | undefined) ?? {
      label: status || "Unknown",
      ...NEUTRAL_FALLBACK,
    };
  // Only the queued countdown label varies at runtime — override just that.
  const config: StatusConfig =
    status === "queued" && countdownLabel
      ? { ...base, label: countdownLabel }
      : base;

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
  // D-07 Strong tier: an error-severity finding is the same "needs
  // operator action" category as `regression`/`reject`.
  error: {
    label: "Error",
    className: "bg-[var(--status-error-fill)] text-[var(--status-error-on-fill)]",
    Icon: XCircle,
  },
  // D-07 Quiet tier: not named directly; minimal-change default, unchanged.
  warning: {
    label: "Warning",
    className: "bg-[var(--status-warn)]/20 text-[var(--status-warn)]",
    Icon: AlertTriangle,
  },
  // D-07 Quiet tier: not named directly; minimal-change default, unchanged.
  info: {
    label: "Info",
    className: "bg-[var(--status-info)]/20 text-[var(--status-info)]",
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
  // D-07 Quietest tier: "admit" is a definitive positive terminal outcome,
  // the same bucket as job `completed`/swarm `done`.
  admit: {
    label: "Admit",
    className: "bg-muted text-muted-foreground",
    Icon: CheckCircle,
  },
  // D-07 Strong tier: D-07 names "rejected verification" directly, and a
  // `reject` verdict IS a rejected verification in this vocabulary.
  reject: {
    label: "Reject",
    className: "bg-[var(--status-error-fill)] text-[var(--status-error-on-fill)]",
    Icon: XCircle,
  },
  // D-07 Quiet tier: this is a distinct, lesser condition from `reject` —
  // the verification PROCESS errored, not a definitive content rejection.
  // The map's own original author already keyed this to `warn`, not
  // `error`, despite the "error" key name; minimal-change default, kept
  // exactly as authored.
  error: {
    label: "Error",
    className: "bg-[var(--status-warn)]/20 text-[var(--status-warn)]",
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
  // review #10: single Badge for both the mapped and unmapped cases — the two
  // branches were verbatim-identical wrappers differing only in icon/label, so
  // any chip-shape change had to be edited twice or they'd drift. An unmapped
  // destination falls back to the raw string with no icon.
  const config = DESTINATION_MAP[destination];
  const Icon = config?.Icon;
  const label = config?.label ?? destination;

  // UI-SPEC's chip shape (inline-flex items-center gap-1 rounded-full
  // px-2.5 py-0.5 text-sm font-semibold) applies uniformly across the chip
  // family, merged onto the shadcn Badge's own variant="outline" classes via
  // cn()/tailwind-merge (later classes win on conflicting utilities).
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
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {label}
    </Badge>
  );
}
