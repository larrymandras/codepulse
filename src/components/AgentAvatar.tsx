import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

interface AvatarData {
  name: string;
  emoji?: string;
  color?: string;
  imageStorageId?: Id<"_storage">;
}

interface AgentAvatarProps {
  avatar: AvatarData | null;
  status?: "active" | "working" | "idle" | "completed" | "error";
  size?: "sm" | "md" | "lg";
}

const SIZE_MAP = { sm: 24, md: 40, lg: 64 };

const STATUS_RING: Record<string, string> = {
  active: "ring-green-400 shadow-[0_0_6px_rgba(74,222,128,0.4)]",
  working: "ring-blue-400 animate-pulse shadow-[0_0_6px_rgba(96,165,250,0.4)]",
  idle: "ring-gray-500",
  completed: "ring-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.3)]",
  error: "ring-red-400 shadow-[0_0_6px_rgba(248,113,113,0.4)]",
};

const DEFAULT_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f97316",
  "#22c55e", "#06b6d4", "#f59e0b", "#ef4444",
];

function getColor(name: string, override?: string): string {
  if (override) return override;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return DEFAULT_COLORS[Math.abs(hash) % DEFAULT_COLORS.length];
}

function AvatarImage({ storageId, size, alt }: { storageId: Id<"_storage">; size: number; alt: string }) {
  const url = useQuery(api.avatars.getImageUrl, { storageId });
  if (!url) {
    return (
      <div
        className="rounded-full bg-gray-700 animate-pulse"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}

export default function AgentAvatar({ avatar, status = "idle", size = "md" }: AgentAvatarProps) {
  const px = SIZE_MAP[size];
  const ringClass = STATUS_RING[status] ?? STATUS_RING.idle;
  const fontSize = size === "sm" ? "text-xs" : size === "md" ? "text-base" : "text-2xl";

  return (
    <div
      className={`relative rounded-full ring-2 ${ringClass} flex-shrink-0`}
      style={{ width: px, height: px }}
    >
      {avatar?.imageStorageId ? (
        <AvatarImage storageId={avatar.imageStorageId} size={px} alt={avatar.name} />
      ) : avatar?.emoji ? (
        <div
          className="rounded-full flex items-center justify-center"
          style={{ width: px, height: px, backgroundColor: getColor(avatar.name, avatar.color) }}
        >
          <span className={fontSize}>{avatar.emoji}</span>
        </div>
      ) : (
        <div
          className="rounded-full flex items-center justify-center"
          style={{ width: px, height: px, backgroundColor: getColor(avatar?.name ?? "?", avatar?.color) }}
        >
          <span className={`font-bold text-white ${fontSize}`}>
            {(avatar?.name ?? "?")[0].toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
}
