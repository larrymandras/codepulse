/**
 * useAgentAvatarResolver — map an agent identifier to its AvatarData.
 *
 * Mirrors the roster resolution chain (useRosterAgents): an agent profile
 * carries an optional `avatarId`, which points at an `avatars` record holding
 * the renderable {name, emoji, color, imageStorageId}. Swarm task nodes only
 * know an agent by `agentId` / `claimedBy` (a profileId or a profile name), so
 * the resolver is keyed by BOTH profileId and name to match either form.
 *
 * Returns a stable lookup function: pass an agent key, get AvatarData | undefined.
 */
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { AvatarData } from "./useRosterAgents";

export function useAgentAvatarResolver(): (key?: string | null) => AvatarData | undefined {
  const agentProfiles = useQuery(api.agentProfiles.list) ?? [];
  const avatarRecords = useQuery(api.avatars.list) ?? [];

  return useMemo(() => {
    const byKey = new Map<string, AvatarData>();
    for (const profile of agentProfiles) {
      if (!profile.avatarId) continue;
      const avatar = avatarRecords.find((av) => av._id === profile.avatarId);
      if (!avatar) continue;
      const data: AvatarData = {
        name: avatar.name,
        emoji: avatar.emoji,
        color: avatar.color,
        imageStorageId: avatar.imageStorageId,
      };
      if (profile.profileId) byKey.set(profile.profileId, data);
      if (profile.name) byKey.set(profile.name, data);
    }
    return (key?: string | null) => (key ? byKey.get(key) : undefined);
  }, [agentProfiles, avatarRecords]);
}
