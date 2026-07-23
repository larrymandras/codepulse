/**
 * skillRun.ts — shared Run/launch contracts (Phase 99 Plan 01).
 *
 * Every downstream launch surface (QuickDeck, SkillLifecycleMenu Run item,
 * the Chat auto-send arg step, the Ástríðr persona dispatch) imports these
 * types verbatim instead of inventing divergent shapes. Nothing in this
 * module fires a real send — it's the interface + last-pick persistence only.
 */

import type { ProfileId } from "./profiles";

export type RunTarget = "chat" | "forge" | "astridr";

// The payload navigate('/chat', { state: { autoSend } }) carries to Chat.tsx.
// Chat.tsx fires the real chat.send AND recordSkillLaunch on confirmed send.
export interface AutoSendHandoff {
  text: string; // full invocation incl. leading slash + any args, e.g. "/gsd-plan-phase 99"
  skillName: string; // registry key — Chat.tsx uses it for recordSkillLaunch({ name })
  profile?: ProfileId; // Ástríðr target only; scopes SecurityContext.profile_id (D-14a) — never a persona-voice switch
}

export const RUN_TARGET_STORAGE_KEY = "codepulse-skills-run-target";

const VALID_RUN_TARGETS: readonly RunTarget[] = ["chat", "forge", "astridr"];

export function isValidRunTarget(v: string | null): v is RunTarget {
  return v !== null && (VALID_RUN_TARGETS as readonly string[]).includes(v);
}

/** SSR-safe: returns "chat" when window is unavailable or the stored value is invalid. */
export function loadStoredRunTarget(): RunTarget {
  if (typeof window === "undefined") return "chat";
  const stored = window.localStorage.getItem(RUN_TARGET_STORAGE_KEY);
  return isValidRunTarget(stored) ? stored : "chat";
}

export function storeRunTarget(t: RunTarget): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RUN_TARGET_STORAGE_KEY, t);
}
