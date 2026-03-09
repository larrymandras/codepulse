import type { Id } from "../convex/_generated/dataModel";

// ============================================================
// Shared frontend types derived from Convex schema
// ============================================================

/** A metric snapshot from the profileMetrics table */
export interface ProfileMetric {
  profileId: string;
  metric: string;
  value: number;
  timestamp: number;
}

/** Agent record from the agents table */
export interface Agent {
  _id: Id<"agents">;
  sessionId: string;
  agentId: string;
  parentAgentId?: string;
  agentType: string;
  status: string;
  startedAt: number;
  endedAt?: number;
  model?: string;
}

/** Agent profile from the agentProfiles table */
export interface AgentProfile {
  _id: Id<"agentProfiles">;
  profileId: string;
  name: string;
  model?: string;
  systemPrompt?: string;
  tools?: string[];
  avatarId?: Id<"avatars">;
  displayName?: string;
  createdAt: number;
  updatedAt: number;
}

/** Avatar record from the avatars table */
export interface Avatar {
  _id: Id<"avatars">;
  name: string;
  description?: string;
  capabilities?: string[];
  imageStorageId?: Id<"_storage">;
  emoji?: string;
  color?: string;
  createdAt: number;
}
