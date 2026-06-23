/**
 * RoomListItem — Sidebar list row for a War Room.
 *
 * Shows room name, status badge, participant count, and active ping indicator.
 *
 * Phase 72, Plan 03: D-04
 */

import { StatusBadge } from "@/components/StatusBadge";

export interface RoomListItemProps {
  room: {
    _id: string;
    roomId: string;
    name: string;
    status: string;
    participantIds?: string[];
  };
  isSelected: boolean;
  onSelect: () => void;
}

export function RoomListItem({ room, isSelected, onSelect }: RoomListItemProps) {
  return (
    <div
      className={`px-4 py-3 cursor-pointer transition-colors border-l-2 ${
        isSelected
          ? "bg-(--accent) border-(--primary)"
          : "border-transparent hover:bg-(--accent)/50"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {room.status === "active" && (
            <span className="ping-indicator inline-block w-2 h-2 rounded-full bg-[var(--speaking-ring)] mr-2" />
          )}
          <span className="text-base font-medium truncate">{room.name}</span>
        </div>
        <StatusBadge status={room.status} />
      </div>
      <p className="text-sm text-muted-foreground mt-0.5">
        {room.participantIds?.length ?? 0} participants
      </p>
    </div>
  );
}
