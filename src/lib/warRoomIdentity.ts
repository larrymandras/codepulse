/**
 * warRoomIdentity.ts — Interface skeleton (Phase 90, Plan 02).
 *
 * SKELETON ONLY — bodies throw "not implemented".
 * Real implementation ships in Plan 05.
 *
 * Contracts exposed here so downstream tests (AgentVoiceCard.test.tsx) can
 * import and fail RED on behavior rather than on a missing module.
 *
 * resolveParticipant: maps a LiveKit participant id → AgentVoiceCardProps
 *   - Known participant (id matches an agent): agent.name, agent.avatarData, tier roleBadge
 *   - Unknown participant: "Agent #" + pid.slice(-4), { name: pid } avatar, "Agent" roleBadge
 *   - Operator self: "You", styled avatar, "Operator" roleBadge
 *
 * resolveAgentColor: maps a speakerId → hex color string
 *   - Known agent: agent.avatarData.color
 *   - Unknown: deterministic hash via getColor(speakerId)
 */

import type { AgentVoiceCardProps } from '@/components/AgentVoiceCard';
import type { RosterAgent } from '@/hooks/useRosterAgents';
// getColor will be used in the real implementation (Plan 05).
import { getColor as _getColor } from '@/components/AgentAvatar'; // eslint-disable-line @typescript-eslint/no-unused-vars

// Re-export getColor so callers of warRoomIdentity can access it without
// reaching into AgentAvatar directly.
export { getColor } from '@/components/AgentAvatar';

/**
 * Resolve a LiveKit participant id to the props needed by AgentVoiceCard.
 *
 * @param pid         LiveKit participant identity string.
 * @param agents      Roster agent list from useRosterAgents.
 * @param isOperatorSelf  True when pid corresponds to the local operator.
 */
export function resolveParticipant(
  pid: string,
  agents: RosterAgent[],
  isOperatorSelf: boolean,
): AgentVoiceCardProps {
  // Satisfy TypeScript — parameters are used in the real implementation.
  void pid;
  void agents;
  void isOperatorSelf;
  throw new Error('resolveParticipant: not implemented (Plan 05)');
}

/**
 * Resolve a speaker id to a deterministic hex color for transcript coloring.
 *
 * @param speakerId  LiveKit participant identity or agent id.
 * @param agents     Roster agent list from useRosterAgents.
 */
export function resolveAgentColor(speakerId: string, agents: RosterAgent[]): string {
  void speakerId;
  void agents;
  throw new Error('resolveAgentColor: not implemented (Plan 05)');
}
