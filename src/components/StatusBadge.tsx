/**
 * StatusBadge — shared status chip consumed by 22 sites across job status,
 * execution mode, voice call, roster, swarm-task and quality vocabularies.
 *
 * D-07 (Phase 122) badge law: emphasis is keyed to a TIER, an axis
 * independent of the semantic colour — a mode can carry a colour without
 * carrying an outcome's emphasis. This supersedes POLISH-05/D-16's "only
 * Failed renders filled" rule, which conflated MODE (how a run is
 * configured) with OUTCOME (whether it succeeded) — `strict` used to render
 * with the same fill as a genuine failure. Four tiers:
 *   - strong    -> filled, reserved for conditions demanding operator
 *                  action (failed, authentication failure, regression,
 *                  rejected verification, stalled)
 *   - quiet     -> coloured text + low-opacity border, no fill (Phase 120's
 *                  original "quiet" treatment; running/queued/stopping)
 *   - quietest  -> flat neutral, no colour, no border (succeeded/completed,
 *                  inactive administrative states)
 *   - mode      -> a wholly separate visual grammar (dashed border) so an
 *                  execution MODE is never mistaken for an outcome,
 *                  regardless of which colour rides along on `semantic`
 * See 122-BADGE-LAW.md for the full per-entry assignment and reasoning.
 */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tier = "strong" | "quiet" | "quietest" | "mode";

interface StatusBadgeProps {
  status: "ok" | "error" | "warn" | "idle" | string;
  label?: string;
  /**
   * Direct-semantic-literal callers (bypassing legacyMap) may override the
   * tier explicitly. A domain word resolved through legacyMap always uses
   * its own recorded tier; an unmapped status defaults its tier from
   * `semantic` (see defaultTierForSemantic).
   */
  tier?: Tier;
}

// Strong tier: filled. `error` uses the sanctioned fill pair
// (--status-error-fill/--status-error-on-fill, defined by plan 122-03 for
// exactly this). `warn` reuses the app's existing sanctioned solid-warn-
// fill idiom (IdeationRow.tsx:30, InboxCard.tsx:98, ScanResultsPanel.tsx:41,
// TaskDetail.tsx:29 all already use this exact pairing) rather than
// inventing a new token — needed so a warn-semantic Strong entry (e.g. an
// authentication failure) stays visually distinct from an error-semantic
// Strong entry (a genuine failure) while both are equally "filled". No
// hex, no palette class — token-driven per CLAUDE.md.
const strongStyles: Record<string, string> = {
  error: "bg-(--status-error-fill) text-(--status-error-on-fill)",
  warn: "bg-(--status-warn) text-(--foreground)",
};

// Quiet-but-unmistakable tier: colour lives in the text and a low-opacity
// border of the same token, never in a saturated bg fill. This is byte-
// identical to Phase 120's POLISH-05 "quiet" style for ok/warn/info/error —
// unchanged where an entry's tier stays Quiet, per the handoff's "the quiet
// law improved contrast on every badge it touched, do not undo it."
const quietStyles: Record<string, string> = {
  ok: "text-(--status-ok) border border-(--status-ok)/40 bg-transparent",
  error: "text-(--status-error) border border-(--status-error)/40 bg-transparent",
  warn: "text-(--status-warn) border border-(--status-warn)/40 bg-transparent",
  info: "text-(--status-info) border border-(--status-info)/40 bg-transparent",
  idle: "border border-muted-foreground/40 text-muted-foreground bg-transparent",
};

// Quietest tier: flat, no colour, no border — administrative/inactive/
// terminal-success states recede further than an in-progress "quiet" chip.
const QUIETEST_STYLE = "bg-muted text-muted-foreground";

// Mode grammar: a dashed border is the "wholly separate visual grammar"
// D-07 requires — visually unmistakable from every outcome tier (strong's
// solid fill, quiet's solid border, quietest's flat none) regardless of
// which colour token `semantic` supplies.
const modeStyles: Record<string, string> = {
  ok: "text-(--status-ok) border border-dashed border-(--status-ok)/40 bg-transparent",
  warn: "text-(--status-warn) border border-dashed border-(--status-warn)/40 bg-transparent",
  error: "text-(--status-error) border border-dashed border-(--status-error)/40 bg-transparent",
};

const KNOWN_SEMANTICS = new Set(["ok", "error", "warn", "info", "idle"]);

// Direct-semantic-literal callers (CronJobList, FactsTable, WhatsApp,
// Security, Dreaming, Memory) pass "ok"/"error"/"warn"/"info"/"idle"
// directly, bypassing legacyMap. Their tier is derived from the semantic
// itself unless the caller overrides it. A genuinely unrecognised status
// word (neither in legacyMap nor a known semantic) defaults to quietest —
// the pre-existing "unknown status renders the flat bg-muted fallback,
// never crashes" behaviour, preserved exactly.
function defaultTierForSemantic(semantic: string): Tier {
  if (semantic === "error") return "strong";
  if (!KNOWN_SEMANTICS.has(semantic)) return "quietest";
  return semantic === "idle" ? "quietest" : "quiet";
}

function styleFor(semantic: string, tier: Tier): string {
  if (tier === "strong") return strongStyles[semantic] ?? strongStyles.error;
  if (tier === "quietest") return QUIETEST_STYLE;
  if (tier === "mode") return modeStyles[semantic] ?? modeStyles.warn;
  return quietStyles[semantic] ?? quietStyles.idle;
}

// D-15: the four spine words are `running`, `completed`, `failed`, `stopped`
// (this vocabulary's word for "stopped" is `cancelled`). This lookup mixes
// SIX unrelated vocabularies behind one component (job/execution status,
// execution mode, voice call, roster, swarm task, quality) — only
// `completed`'s label is relabelled to the spine word; every other label,
// including the case convention, is left alone so this phase does not
// create a NEW inconsistency inside one file. The swarm `done` entry below
// deliberately keeps its original label — it is a different vocabulary
// that happens to share the same word, not the same state as job
// `completed`. `tier` is this phase's D-07 addition — see 122-BADGE-LAW.md
// for the reasoning behind every entry, especially `strict` (moved to the
// mode grammar) and `deregistered`/`done` (moved to quietest, beyond the
// two changes D-07 names explicitly).
const legacyMap: Record<string, { semantic: string; label: string; tier: Tier }> = {
  queued: { semantic: "idle", label: "QUEUED", tier: "quiet" },
  running: { semantic: "warn", label: "RUNNING", tier: "quiet" },
  completed: { semantic: "ok", label: "SUCCEEDED", tier: "quietest" },
  failed: { semantic: "error", label: "FAILED", tier: "strong" },
  cancelled: { semantic: "warn", label: "CANCELLED", tier: "quiet" },
  timed_out: { semantic: "warn", label: "TIMEOUT", tier: "quiet" },
  // Execution modes (v6.0) -- separate visual grammar (D-07), never Strong.
  strict: { semantic: "error", label: "STRICT", tier: "mode" },
  adaptive: { semantic: "warn", label: "ADAPTIVE", tier: "mode" },
  standard: { semantic: "ok", label: "STANDARD", tier: "mode" },
  filler: { semantic: "warn", label: "FILLER", tier: "mode" },
  // `stalled` is an OUTCOME (a run stalled), not a mode, despite living in
  // this v6.0 block -- D-07's Strong tier names it explicitly. Unreached by
  // any live call site today (ExecutionTable.tsx renders modeData.stalledAt
  // as inline text, never as a StatusBadge status word) but kept correct.
  stalled: { semantic: "error", label: "STALLED", tier: "strong" },
  // Voice call statuses (Phase 72)
  live: { semantic: "ok", label: "LIVE", tier: "quiet" },
  ended: { semantic: "idle", label: "ENDED", tier: "quietest" },
  joining: { semantic: "warn", label: "JOINING", tier: "quiet" },
  // Agent roster statuses (Phase 76)
  active: { semantic: "ok", label: "ACTIVE", tier: "quiet" },
  pending: { semantic: "warn", label: "PENDING", tier: "quiet" },
  idle: { semantic: "idle", label: "IDLE", tier: "quietest" },
  // `deregistered` moves OUT of Strong under the new law: it is an
  // administrative removal unrelated to any run's result (120-BADGE-
  // INVENTORY.md §4), not one of D-07's five named Strong states — it only
  // rendered filled before as a side effect of sharing the `error`
  // semantic with genuine failures.
  deregistered: { semantic: "error", label: "REMOVED", tier: "quietest" },
  // Swarm task states (Phase 149)
  claimed: { semantic: "warn", label: "CLAIMED", tier: "quiet" },
  verifying: { semantic: "ok", label: "VERIFYING", tier: "quiet" },
  // `done` is a terminal success, parallel to job `completed` -- shares its
  // QUIETEST tier while keeping its own DONE label (tier and vocabulary are
  // orthogonal; the D-15 control below proves the label stayed put).
  done: { semantic: "ok", label: "DONE", tier: "quietest" },
  verify_rejected: { semantic: "error", label: "REJECTED", tier: "strong" },
  // Quality regression alert (Phase 93 EVAL-03, D-13)
  regression: { semantic: "error", label: "REGRESSION", tier: "strong" },
};

export function StatusBadge({ status, label, tier: tierProp }: StatusBadgeProps) {
  const legacy = legacyMap[status];
  const resolvedSemantic = legacy?.semantic ?? status;
  const resolvedLabel = label ?? legacy?.label ?? status.toUpperCase();
  const resolvedTier: Tier =
    legacy?.tier ?? tierProp ?? defaultTierForSemantic(resolvedSemantic);
  const style = styleFor(resolvedSemantic, resolvedTier);

  return (
    <Badge variant="secondary" className={cn("rounded-sm text-sm", style)}>
      {resolvedLabel}
    </Badge>
  );
}

export default StatusBadge;
