/**
 * useAgentAvatarResolver — map an agent identifier to its AvatarData.
 *
 * Resolution sources (both indexed, case/locale-insensitive):
 *  1. Every `avatars` record, keyed by its own name. Swarm task nodes know an
 *     agent only by persona name (`claimedBy` = "hervor", "skuld", …) and the
 *     persona avatars are standalone records named "Hervor"/"Skuld" with images,
 *     NOT linked through agentProfiles — so a direct name index is what makes the
 *     picture appear. A case-insensitive + NFC-normalized key bridges
 *     "hervor" ↔ "Hervor" and "Ástríðr" ↔ "ástríðr".
 *  2. The agentProfiles.avatarId → avatars chain (mirrors useRosterAgents), keyed
 *     by both profileId and profile name, so hash-keyed profiles also resolve.
 *
 * When two avatars share a name, the one WITH an image wins (personas carry both
 * an emoji and an uploaded image; we prefer the richer record).
 *
 * Returns a stable lookup function: pass an agent key, get AvatarData | undefined.
 */
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { AvatarData } from "./useRosterAgents";

/** Normalize an agent key for case/locale-insensitive matching. */
export function normAgentKey(s: string): string {
  return s.normalize("NFC").toLowerCase().trim();
}

interface AvatarRecordLike {
  _id: string;
  name: string;
  emoji?: string;
  color?: string;
  imageStorageId?: AvatarData["imageStorageId"];
}

interface ProfileLike {
  profileId?: string;
  name?: string;
  avatarId?: string | null;
}

/**
 * Pure index builder (testable without React). Maps normalized agent keys
 * (avatar names, profileIds, profile names) → AvatarData.
 */
export function buildAvatarIndex(
  avatars: AvatarRecordLike[],
  profiles: ProfileLike[],
): Map<string, AvatarData> {
  const byKey = new Map<string, AvatarData>();
  const toData = (a: AvatarRecordLike): AvatarData => ({
    name: a.name,
    emoji: a.emoji,
    color: a.color,
    imageStorageId: a.imageStorageId,
  });

  // 1) Index every avatar by its own name; prefer an image on name collisions.
  for (const a of avatars) {
    if (!a.name) continue;
    const key = normAgentKey(a.name);
    const existing = byKey.get(key);
    if (!existing || (!existing.imageStorageId && a.imageStorageId)) {
      byKey.set(key, toData(a));
    }
  }

  // 2) Index via the agentProfiles.avatarId chain (profileId + profile name).
  for (const profile of profiles) {
    if (!profile.avatarId) continue;
    const avatar = avatars.find((av) => av._id === profile.avatarId);
    if (!avatar) continue;
    const data = toData(avatar);
    if (profile.profileId) byKey.set(normAgentKey(profile.profileId), data);
    if (profile.name) byKey.set(normAgentKey(profile.name), data);
  }

  return byKey;
}

export function useAgentAvatarResolver(): (key?: string | null) => AvatarData | undefined {
  const agentProfiles = useQuery(api.agentProfiles.list) ?? [];
  const avatarRecords = useQuery(api.avatars.list) ?? [];

  return useMemo(() => {
    const index = buildAvatarIndex(
      avatarRecords as AvatarRecordLike[],
      agentProfiles as ProfileLike[],
    );
    return (key?: string | null) => (key ? index.get(normAgentKey(key)) : undefined);
  }, [agentProfiles, avatarRecords]);
}
