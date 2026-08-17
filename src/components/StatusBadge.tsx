/**
 * StatusBadge — shared status chip consumed by 19 sites across job status,
 * execution mode, voice call, roster and swarm-task vocabularies.
 *
 * POLISH-05 / D-16 badge law: only Failed (semantic `error`) renders filled.
 * Every other semantic renders quiet (text + low-opacity border, no bg
 * fill). Do not reintroduce a `bg-(--status-*)` fill on `ok`/`warn`/`info`.
 */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "ok" | "error" | "warn" | "idle" | string;
  label?: string;
}

// POLISH-05 / D-16: only Failed renders filled. Every other semantic is a
// quiet chip — colour lives in the text and a low-opacity border of the same
// token, never in a saturated bg fill. `idle` was already quiet (bg-muted is
// a neutral chip, not a status fill) and is left untouched; JobsPanel.test.tsx
// pins it.
const semanticStyles: Record<string, string> = {
  ok: "text-(--status-ok) border border-(--status-ok)/40 bg-transparent",
  error: "bg-(--status-error) text-white",
  warn: "text-(--status-warn) border border-(--status-warn)/40 bg-transparent",
  info: "text-(--status-info) border border-(--status-info)/40 bg-transparent",
  idle: "bg-muted text-muted-foreground",
};

// D-15: the four spine words are `running`, `completed`, `failed`, `stopped`
// (this vocabulary's word for "stopped" is `cancelled`). This lookup mixes
// FIVE unrelated vocabularies behind one component (job/execution status,
// execution mode, voice call, roster, swarm task) — only `completed`'s label
// is relabelled below to the spine word; every other label, including the
// case convention, is left alone so this phase does not create a NEW
// inconsistency inside one file. The swarm `done` entry below deliberately
// keeps its original label — it is a different vocabulary that happens to
// share the same word, not the same state as job `completed`.
const legacyMap: Record<string, { semantic: string; label: string }> = {
  queued: { semantic: "idle", label: "QUEUED" },
  running: { semantic: "warn", label: "RUNNING" },
  completed: { semantic: "ok", label: "SUCCEEDED" },
  failed: { semantic: "error", label: "FAILED" },
  cancelled: { semantic: "warn", label: "CANCELLED" },
  timed_out: { semantic: "warn", label: "TIMEOUT" },
  // Execution modes (v6.0)
  strict: { semantic: "error", label: "STRICT" },
  adaptive: { semantic: "warn", label: "ADAPTIVE" },
  standard: { semantic: "ok", label: "STANDARD" },
  filler: { semantic: "warn", label: "FILLER" },
  stalled: { semantic: "error", label: "STALLED" },
  // Voice call statuses (Phase 72)
  live: { semantic: "ok", label: "LIVE" },
  ended: { semantic: "idle", label: "ENDED" },
  joining: { semantic: "warn", label: "JOINING" },
  // Agent roster statuses (Phase 76)
  active: { semantic: "ok", label: "ACTIVE" },
  pending: { semantic: "warn", label: "PENDING" },
  idle: { semantic: "idle", label: "IDLE" },
  deregistered: { semantic: "error", label: "REMOVED" },
  // Swarm task states (Phase 149)
  claimed: { semantic: "warn", label: "CLAIMED" },
  verifying: { semantic: "ok", label: "VERIFYING" },
  done: { semantic: "ok", label: "DONE" },
  verify_rejected: { semantic: "error", label: "REJECTED" },
  // Quality regression alert (Phase 93 EVAL-03, D-13)
  regression: { semantic: "error", label: "REGRESSION" },
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const legacy = legacyMap[status];
  const resolvedSemantic = legacy?.semantic ?? status;
  const resolvedLabel = label ?? legacy?.label ?? status.toUpperCase();
  const style = semanticStyles[resolvedSemantic] ?? semanticStyles.idle;

  return (
    <Badge variant="secondary" className={cn("rounded-sm text-sm", style)}>
      {resolvedLabel}
    </Badge>
  );
}

export default StatusBadge;
