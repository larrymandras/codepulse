/**
 * warRoomIdentity.ts — Pure identity-resolution helpers (Phase 90, Plan 05).
 *
 * Maps a LiveKit participantId → AgentVoiceCard props + transcript color.
 * Pure helpers: no React imports, no hook calls — accepts roster data as params
 * so the module stays unit-testable in isolation.
 *
 * Exports:
 *   resolveParticipant  — pid + roster → AgentVoiceCardProps
 *   resolveAgentColor   — speakerId + roster → hex color string
 *   getColor            — re-exported from AgentAvatar for convenience
 *
 * Security note (T-90-ID): unknown participants NEVER expose the raw pid as
 * their display name. Unknown ids map to "Agent #" + last-4 chars.
 */

import type { AgentVoiceCardProps } from '@/components/AgentVoiceCard';
import type { RosterAgent } from '@/hooks/useRosterAgents';
import { getColor } from '@/components/AgentAvatar';

// Re-export getColor so callers of warRoomIdentity can access it without
// reaching into AgentAvatar directly.
export { getColor } from '@/components/AgentAvatar';

/**
 * Resolve a LiveKit participant id to the props needed by AgentVoiceCard.
 *
 * @param pid             LiveKit participant identity string.
 * @param agents          Roster agent list (from useRosterAgents — passed in, not called here).
 * @param isOperatorSelf  True when pid corresponds to the local operator.
 * @returns               AgentVoiceCardProps with isSpeaking defaulted to false;
 *                        caller should override isSpeaking based on live state.
 */
export function resolveParticipant(
  pid: string,
  agents: RosterAgent[],
  isOperatorSelf: boolean,
): AgentVoiceCardProps {
  // Operator-self case: dedicated "You" card with accent color and Operator badge.
  if (isOperatorSelf) {
    return {
      profileId: pid,
      name: "You",
      avatar: { name: "You", color: "var(--primary)" },
      roleBadge: "Operator",
      isSpeaking: false,
    };
  }

  // Known participant: match by agent id first, then by name.
  const agent = agents.find((a) => a.id === pid || a.name === pid);
  if (agent) {
    return {
      profileId: pid,
      name: agent.name,
      // avatarData is undefined when the agent has no configured avatar;
      // fall back to name-based avatar so getColor can produce a stable color.
      avatar: agent.avatarData ?? { name: agent.name },
      roleBadge: agent.tier ?? "Agent",
      isSpeaking: false,
    };
  }

  // Unknown participant (D-05): deterministic avatar keyed on pid for stable
  // color hash; display name is "Agent #<last4>" — never the raw pid.
  return {
    profileId: pid,
    name: "Agent #" + pid.slice(-4),
    avatar: { name: pid }, // avatar.name = pid drives getColor's deterministic hash
    roleBadge: "Agent",
    isSpeaking: false,
  };
}

/**
 * Resolve a speaker id to a deterministic hex color for transcript chunk coloring.
 *
 * Known agent: returns agent.avatarData.color if set, else getColor(speakerId).
 * Unknown / undefined speakerId: returns getColor(speakerId ?? "").
 *
 * @param speakerId  LiveKit participant identity or agent id (may be undefined for system events).
 * @param agents     Roster agent list (from useRosterAgents — passed in, not called here).
 */
export function resolveAgentColor(speakerId: string | undefined, agents: RosterAgent[]): string {
  if (speakerId) {
    const agent = agents.find((a) => a.id === speakerId || a.name === speakerId);
    if (agent) {
      return agent.avatarData?.color ?? getColor(speakerId);
    }
  }
  return getColor(speakerId ?? "");
}
