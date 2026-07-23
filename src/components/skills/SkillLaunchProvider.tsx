/**
 * SkillLaunchProvider — page-level context hosting ONE ForgeLaunchModal +
 * the Forge-path recordSkillLaunch (Phase 99 Plan 04, LAUNCH-02/04,
 * D-10/D-11/D-12).
 *
 * Run lives on every SkillLifecycleMenu row (SkillRow + ColdStorageView) AND
 * on every QuickDeck tile (D-02) — without a shared provider, the Forge
 * modal + its recordSkillLaunch wiring would have to be prop-drilled through
 * several component layers for each surface. This context mirrors the house
 * PrivacyContext/AmbientContext precedent: a single createContext + a
 * `useX must be inside provider` throw, mounted once near the app root.
 *
 * Chat/Ástríðr targets do NOT go through this provider — they navigate with
 * an AutoSendHandoff (Plan 01/02/03) and Chat.tsx fires the real send +
 * recordSkillLaunch itself. Only the Forge path needs one shared page-level
 * modal instance (D-11): opening a second ForgeLaunchModal per Run trigger
 * would duplicate the host/agent/workspace picker state and Clerk-gated
 * enqueueLaunch wiring for no reason.
 *
 * `lastTarget`/`setLastTarget` also lives here (not duplicated per chooser
 * instance) so every RunTargetChooser on the page reflects the same
 * remembered pick immediately after any one of them changes it.
 */
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ForgeLaunchModal } from "@/components/forge/ForgeLaunchModal";
import type { ForgeCommandRow } from "@/hooks/useForge";
import { skillInvocation, type SkillLike } from "@/lib/skills";
import {
  loadStoredRunTarget,
  storeRunTarget,
  type RunTarget,
} from "@/lib/skillRun";

/** The minimal skill shape launchForge needs: a registry name + display label. */
export type ForgeLaunchableSkill = SkillLike & {
  name: string;
  displayName: string;
};

interface SkillLaunchContextValue {
  lastTarget: RunTarget;
  setLastTarget: (t: RunTarget) => void;
  /** Opens the page-level ForgeLaunchModal prefilled with the skill's invocation (D-10). */
  launchForge: (skill: ForgeLaunchableSkill) => void;
}

const SkillLaunchContext = createContext<SkillLaunchContextValue | null>(null);

export function SkillLaunchProvider({ children }: { children: ReactNode }) {
  const [lastTarget, setLastTargetState] = useState<RunTarget>(
    loadStoredRunTarget
  );
  const [forgeOpen, setForgeOpen] = useState(false);
  const [forgePrompt, setForgePrompt] = useState("");
  const [forgeSkillName, setForgeSkillName] = useState("");

  const recordSkillLaunch = useMutation(api.registry.recordSkillLaunch);

  const setLastTarget = useCallback((t: RunTarget) => {
    storeRunTarget(t);
    setLastTargetState(t);
  }, []);

  const launchForge = useCallback((skill: ForgeLaunchableSkill) => {
    // D-10: the Forge instruction is the /skill invocation verbatim, editable
    // in the modal's prompt textarea — never a paraphrase.
    setForgePrompt(`${skillInvocation(skill)} `);
    setForgeSkillName(skill.name);
    setForgeOpen(true);
  }, []);

  // CR-02 (99-07): onLaunched is the modal's OPTIMISTIC pre-await paint —
  // it fires before the enqueue mutation is even called, so it must never
  // record a launch on its own (a rejected enqueue would still inflate
  // useCount). No row-paint state lives in this provider today, so there is
  // nothing else to do here — recording moved to handleLaunchConfirmed below.
  const handleLaunched = useCallback((_row: ForgeCommandRow) => {}, []);

  // D-12: record fires ONLY on confirmed enqueue — the modal's
  // onLaunchConfirmed callback, invoked after `await launch(...)` resolves —
  // never on the optimistic paint above and never on failure/cancel/close.
  // This is the one Forge-path recording point every Run trigger shares.
  const handleLaunchConfirmed = useCallback(() => {
    void recordSkillLaunch({ name: forgeSkillName });
  }, [recordSkillLaunch, forgeSkillName]);

  const handleLaunchFailed = useCallback(() => {
    // No recordSkillLaunch here (D-12) — enqueueLaunch's own failed/expired
    // row state already surfaces the failure honestly via the modal's
    // existing pending-row reconciliation; this provider adds no new copy.
    setForgeOpen(false);
  }, []);

  const handleClose = useCallback(() => {
    setForgeOpen(false);
  }, []);

  return (
    <SkillLaunchContext.Provider value={{ lastTarget, setLastTarget, launchForge }}>
      {children}
      <ForgeLaunchModal
        open={forgeOpen}
        onClose={handleClose}
        onLaunched={handleLaunched}
        onLaunchFailed={handleLaunchFailed}
        onLaunchConfirmed={handleLaunchConfirmed}
        initialPrompt={forgePrompt}
      />
    </SkillLaunchContext.Provider>
  );
}

export function useSkillLaunch(): SkillLaunchContextValue {
  const ctx = useContext(SkillLaunchContext);
  if (!ctx) {
    throw new Error("useSkillLaunch must be used within SkillLaunchProvider");
  }
  return ctx;
}
