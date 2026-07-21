/**
 * SkillLifecycleMenu — scope-gated ⋯ menu wiring Archive/Restore/Move/Delete
 * (Phase 98 Plan 04, LIFE-01..06). Self-contained: owns its own DropdownMenu,
 * the Move/Delete dialog open state, calls `enqueueLifecycle` directly for
 * the no-dialog actions (Archive, Restore, Move-to-Global), and overlays the
 * reused `RowStatusBadge` for an in-flight command. See 98-UI-SPEC.md
 * §1 (menu), §3 (shadow-block), §4 (move dialog), §5 (delete dialog).
 *
 * Never renders an action the row's current scope doesn't support (D-07):
 *   - dormant row            -> Restore, Delete Permanently
 *   - active, single scope   -> Archive, Move to {other scope}…
 *   - active, multiple scopes -> Archive/Move disabled, honest reason (Pitfall 1a)
 *   - lane="cold" (98-REVIEW WR-04): rendered from ColdStorageView for a row
 *     whose name ALSO has an active copy (merged shadowed row) — acts on the
 *     DORMANT copy: Restore disabled with the shadow tooltip, Delete offered.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  MoreVertical,
  Archive as ArchiveIcon,
  ArchiveRestore,
  FolderInput,
  Trash2,
} from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isDormant, isShadowing, DORMANT_ORIGIN } from "@/lib/skills";
import type { RowSkill } from "./SkillRow";
import { useForgeHostsRaw } from "@/hooks/useForge";
import {
  useLifecycleCommands,
  latestLifecycleForSkill,
  lifecycleRefusalMessage,
} from "@/hooks/useLifecycle";
import { RowStatusBadge } from "./IntakeStatusBadge";
import { MoveToProjectDialog } from "./MoveToProjectDialog";
import { DeleteSkillDialog } from "./DeleteSkillDialog";

/** Mirrors IntakeModal's D-08 online-host threshold. */
const ONLINE_THRESHOLD_MS = 30_000;

interface HostLike {
  hostId: string;
  lastSeenAt: number;
}

/**
 * Pure host-resolution helper — exported for direct unit testing. Mirrors
 * IntakeModal's D-08 auto-select: most-recently-seen ONLINE host wins; if
 * none is online, fall back to the most-recently-seen host overall so an
 * offline-only command can still queue-and-expire honestly (LIFE-06)
 * instead of silently going nowhere. An explicit override always wins.
 */
export function resolveHostId(hosts: HostLike[], explicit?: string): string {
  if (explicit) return explicit;
  const onlineNewestFirst = hosts
    .filter((h) => Date.now() - h.lastSeenAt < ONLINE_THRESHOLD_MS)
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  if (onlineNewestFirst.length > 0) return onlineNewestFirst[0].hostId;
  const newestFirst = [...hosts].sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  return newestFirst[0]?.hostId ?? "";
}

/** "claude-code" -> "global", "claude-code:project:<key>" -> "project". */
function scopeLabel(origin: string): string {
  if (origin === "claude-code") return "global";
  if (origin.startsWith("claude-code:project:")) return "project";
  return origin;
}

interface SkillLifecycleMenuProps {
  skill: RowSkill;
  /**
   * Explicit host override (mainly for tests/callers that already resolved
   * one). When omitted, resolves the same way IntakeModal does (D-08) via
   * the existing host hook — no new host-resolution mechanism invented.
   */
  hostId?: string;
  /**
   * Which lane this row is rendered in (98-REVIEW WR-04). The registry merges
   * every origin for a name into ONE row, so a skill that is active AND has a
   * dormant copy renders in both the active list and Cold Storage — the menu
   * must act on the lane's copy, not guess. "cold" forces the dormant-branch
   * menu (Restore — shadow-blocked when an active copy exists — plus Delete
   * Permanently). Defaults to "active" so existing call sites are unchanged.
   */
  lane?: "active" | "cold";
}

export function SkillLifecycleMenu({
  skill,
  hostId: hostIdProp,
  lane = "active",
}: SkillLifecycleMenuProps) {
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const hostsRaw = useForgeHostsRaw();
  const hostId = useMemo(
    () => resolveHostId(hostsRaw ?? [], hostIdProp),
    [hostsRaw, hostIdProp]
  );

  const enqueueLifecycle = useMutation(api.forge.enqueueLifecycle);
  const commands = useLifecycleCommands();
  const latest = latestLifecycleForSkill(commands, skill.name);
  // "done" means the rescan should already reflect the mutation — no badge.
  const inFlight = latest && latest.status !== "done" ? latest : null;

  // The cold lane always shows the dormant-branch menu: a merged shadowed row
  // (active + dormant copies) has isDormant === false, but in Cold Storage the
  // menu acts on the DORMANT copy (98-REVIEW WR-04 — this is what makes the
  // shadow-blocked Restore branch reachable against live merged-row data).
  const dormant = isDormant(skill) || lane === "cold";
  const shadowed = isShadowing(skill);
  const nonDormantOrigins = (skill.origins ?? []).filter(
    (o) => o !== DORMANT_ORIGIN
  );
  const multiScope = nonDormantOrigins.length > 1;
  const activeOrigin = nonDormantOrigins.length === 1 ? nonDormantOrigins[0] : undefined;
  const moveDestinationIsProject = activeOrigin === "claude-code";

  const enqueue = (overrides: {
    action: "archive" | "restore" | "move" | "delete";
    sourceOrigin: string;
    destination: "global" | "project" | "cold";
    workspaceId?: string | null;
  }) => {
    // NOT fire-and-forget (98-REVIEW CR-03): a LAYER-1 preflight refusal
    // throws BEFORE any forgeCommands row exists, so no badge will ever
    // surface it — the rejection here is the only signal the user gets.
    enqueueLifecycle({
      hostId,
      commandId: crypto.randomUUID(),
      skillName: skill.name,
      workspaceId: null,
      ...overrides,
    }).catch((err: unknown) => {
      toast.error(lifecycleRefusalMessage(err));
    });
  };

  const handleArchive = () => {
    if (!activeOrigin) return;
    enqueue({ action: "archive", sourceOrigin: activeOrigin, destination: "cold" });
  };

  const handleRestore = () => {
    // Defense in depth — the disabled item already blocks the click, but
    // never let a client-detectable shadow reach the daemon (D-09/T-98-09).
    if (shadowed) return;
    enqueue({ action: "restore", sourceOrigin: DORMANT_ORIGIN, destination: "global" });
  };

  const handleMoveToGlobal = () => {
    if (!activeOrigin) return;
    enqueue({ action: "move", sourceOrigin: activeOrigin, destination: "global" });
  };

  const blockingOrigin = shadowed
    ? (skill.origins ?? []).find((o) => o !== DORMANT_ORIGIN)
    : undefined;

  return (
    // Local provider (98-REVIEW CR-02): this repo's tooltip.tsx does NOT embed
    // a provider, and neither of DashboardLayout's TooltipProviders wraps the
    // routed <Outlet /> — a bare <Tooltip> here throws at render time and the
    // page ErrorBoundary blanks the whole Skills page. Mirrors
    // CodeVaultGraph.tsx's documented own-provider pattern.
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1.5">
        {inFlight &&
          (inFlight.status === "failed" && inFlight.error ? (
            // WR-02 (98-REVIEW): ackCommand persists actionable house copy in
            // row.error — a bare "Failed" chip dropped it on the floor. Carry
            // it in a Tooltip (local provider guaranteed by CR-02's fix).
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} aria-label={`Failure reason for ${skill.displayName}`}>
                  <RowStatusBadge status="failed" />
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-[320px]">
                {inFlight.error}
              </TooltipContent>
            </Tooltip>
          ) : (
            <RowStatusBadge
              status={inFlight.status as Exclude<typeof inFlight.status, "done">}
            />
          ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Skill actions for ${skill.displayName}`}
              className="min-w-8 min-h-8 flex items-center justify-center rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            // Opening a Dialog/AlertDialog from a menu item fights the
            // DropdownMenu's own close-autofocus return — suppress it so the
            // dialog's own autofocus wins (standard Radix recipe).
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            {dormant ? (
              <>
                {shadowed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* Disabled items are pointer-events:none — wrap in a
                          span so the Tooltip still has a hoverable trigger. */}
                      <span>
                        <DropdownMenuItem
                          disabled
                          onSelect={(e) => e.preventDefault()}
                        >
                          <ArchiveRestore /> Restore
                        </DropdownMenuItem>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {`Shadowed by an active ${scopeLabel(
                        blockingOrigin ?? ""
                      )} skill named "${skill.displayName}" — archive it first.`}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <DropdownMenuItem onSelect={handleRestore}>
                    <ArchiveRestore /> Restore
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 /> Delete Permanently
                </DropdownMenuItem>
              </>
            ) : multiScope ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <DropdownMenuItem
                      disabled
                      onSelect={(e) => e.preventDefault()}
                    >
                      <ArchiveIcon /> Archive
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled
                      onSelect={(e) => e.preventDefault()}
                    >
                      <FolderInput /> Move…
                    </DropdownMenuItem>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Active in multiple scopes — disambiguation ships in a later
                  release.
                </TooltipContent>
              </Tooltip>
            ) : (
              <>
                <DropdownMenuItem onSelect={handleArchive}>
                  <ArchiveIcon /> Archive
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    if (moveDestinationIsProject) {
                      e.preventDefault();
                      setMoveOpen(true);
                    } else {
                      handleMoveToGlobal();
                    }
                  }}
                >
                  <FolderInput />{" "}
                  {moveDestinationIsProject ? "Move to Project…" : "Move to Global…"}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {moveOpen && activeOrigin && (
        <MoveToProjectDialog
          skillName={skill.name}
          sourceOrigin={activeOrigin}
          hostId={hostId}
          open={moveOpen}
          onOpenChange={setMoveOpen}
        />
      )}

      {deleteOpen && (
        <DeleteSkillDialog
          skillName={skill.name}
          sourceOrigin={DORMANT_ORIGIN}
          hostId={hostId}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      )}
    </TooltipProvider>
  );
}
