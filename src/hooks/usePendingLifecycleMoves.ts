/**
 * usePendingLifecycleMoves — the client-only optimistic state machine for
 * drag-triggered lifecycle moves (Plan 100-02, UX-03/D-05). Ports the
 * commandId-dedupe precedent from useIntakeFeed.ts:95-100, made status-aware:
 * a pending entry is correlated by the commandId the caller's enqueueLifecycle
 * call generated — never by skillName alone (Pitfall 1: a second in-flight
 * command for the same skill must never reconcile the wrong drag) — and is
 * cleared silently on "done", cleared + toasted on "failed"/"expired", and
 * left alone on "queued"/"executing".
 *
 * Optimistic state here is CLIENT-ONLY ephemeral: it is never written to
 * Convex and never persisted. It always reconciles to server truth via
 * useLifecycleCommands() (never a false success).
 *
 * Also hosts SkillControlSurfaceProvider — a single React context exposing
 * this pending map plus the transient dragging-skill identity, so ScopeRail
 * and SkillRow read both without prop-drilling through the intermediary list
 * components (Plan 05). JSX is avoided (createElement instead) so this file
 * can stay a plain .ts per the plan's file list.
 */

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useLifecycleCommands, lifecycleRefusalMessage } from "@/hooks/useLifecycle";
import type { SkillLike } from "@/lib/skills";

export type PendingMove = {
  commandId: string;
  action: "archive" | "restore" | "move";
  destination: "global" | "project" | "cold";
};

export interface PendingLifecycleMoves {
  pending: Record<string, PendingMove>;
  beginPending: (skillName: string, move: PendingMove) => void;
  clearPending: (skillName: string) => void;
}

/** The literal expiry copy from IntakeSheet.tsx:135-139 (first line only) — never paraphrase. */
const EXPIRED_COPY = "Expired — no daemon claimed this command.";

export function usePendingLifecycleMoves(): PendingLifecycleMoves {
  const [pending, setPending] = useState<Record<string, PendingMove>>({});

  // useLifecycleCommands() already carries the memoized-stable-identity
  // discipline (useLifecycle.ts's own useMemo) — reused directly as the
  // effect dependency so this hook does not loop (useIntakeFeed.ts:66-68).
  const lifecycleCommands = useLifecycleCommands();

  const beginPending = useCallback((skillName: string, move: PendingMove) => {
    setPending((prev) => ({ ...prev, [skillName]: move }));
  }, []);

  const clearPending = useCallback((skillName: string) => {
    setPending((prev) => {
      if (!(skillName in prev)) return prev;
      const next = { ...prev };
      delete next[skillName];
      return next;
    });
  }, []);

  // Status-aware reconcile against server truth. Correlates strictly by
  // commandId via .find() — never by skillName alone (that helper is reserved
  // for the per-row status badge, not reconciliation — see useLifecycle.ts).
  useEffect(() => {
    setPending((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [skillName, move] of Object.entries(prev)) {
        const row = lifecycleCommands.find((c) => c.commandId === move.commandId);
        if (!row) continue; // still in flight / not yet visible — keep pending
        if (row.status === "done") {
          delete next[skillName];
          changed = true;
        } else if (row.status === "failed") {
          delete next[skillName];
          changed = true;
          toast.error(lifecycleRefusalMessage(row.error ?? ""));
        } else if (row.status === "expired") {
          delete next[skillName];
          changed = true;
          toast.error(EXPIRED_COPY);
        }
        // "queued" / "executing" — leave the entry as-is.
      }
      return changed ? next : prev;
    });
  }, [lifecycleCommands]);

  return { pending, beginPending, clearPending };
}

// ---------------------------------------------------------------------------
// SkillControlSurfaceProvider — hosts the pending map + transient dragging
// identity behind ONE context, so ScopeRail/SkillRow read both without
// prop-drilling through intermediary list components (Plan 05).
// ---------------------------------------------------------------------------

function noop(): void {
  /* safe out-of-provider default */
}

export interface SkillControlSurfaceValue extends PendingLifecycleMoves {
  draggingSkill: SkillLike | null;
  setDraggingSkill: (skill: SkillLike | null) => void;
}

const DEFAULT_VALUE: SkillControlSurfaceValue = {
  pending: {},
  beginPending: noop,
  clearPending: noop,
  draggingSkill: null,
  setDraggingSkill: noop,
};

const SkillControlSurfaceContext = createContext<SkillControlSurfaceValue>(DEFAULT_VALUE);

export function SkillControlSurfaceProvider({ children }: { children: ReactNode }) {
  const { pending, beginPending, clearPending } = usePendingLifecycleMoves();
  const [draggingSkill, setDraggingSkill] = useState<SkillLike | null>(null);

  const value = useMemo<SkillControlSurfaceValue>(
    () => ({ pending, beginPending, clearPending, draggingSkill, setDraggingSkill }),
    [pending, beginPending, clearPending, draggingSkill]
  );

  return createElement(SkillControlSurfaceContext.Provider, { value }, children);
}

/** Full context value. Returns safe defaults (no-op setters, empty/null state) outside a provider. */
export function useSkillControlSurface(): SkillControlSurfaceValue {
  return useContext(SkillControlSurfaceContext);
}

/** The PendingMove for one skill, or undefined if none is in flight. */
export function usePendingMove(skillName: string): PendingMove | undefined {
  const { pending } = useSkillControlSurface();
  return pending[skillName];
}

/** The transient dragging-skill identity + setter. Safe (null + no-op) outside a provider. */
export function useDraggingSkill(): {
  draggingSkill: SkillLike | null;
  setDraggingSkill: (skill: SkillLike | null) => void;
} {
  const { draggingSkill, setDraggingSkill } = useSkillControlSurface();
  return { draggingSkill, setDraggingSkill };
}
