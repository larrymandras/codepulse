/**
 * RoomListItem — Sidebar list row for a War Room.
 *
 * Shows room name, status badge, participant count, and active ping indicator.
 *
 * Phase 72, Plan 03: D-04
 */

import { StatusBadge } from "@/components/StatusBadge";
import { Trash2 } from "lucide-react";

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
  onDelete?: () => void;
}

export function RoomListItem({ room, isSelected, onSelect, onDelete }: RoomListItemProps) {
  return (
    <div
      className={`group px-4 py-3 cursor-pointer transition-colors border-l-2 ${
        isSelected
          ? "bg-(--accent) border-(--primary)"
          : "border-transparent hover:bg-(--accent)/50"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center min-w-0">
          {room.status === "active" && (
            <span className="ping-indicator inline-block w-2 h-2 rounded-full bg-[var(--speaking-ring)] mr-2 shrink-0" />
          )}
          <span className="text-base font-medium truncate">{room.name}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusBadge status={room.status} />
          {onDelete && (
            <button
              type="button"
              aria-label={`Delete room ${room.name}`}
              title="Delete room"
              className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 -mr-1"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground mt-0.5">
        {room.participantIds?.length ?? 0} participants
      </p>
    </div>
  );
}
