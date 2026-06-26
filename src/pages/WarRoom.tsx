/**
 * War Room page — sidebar room list + room detail with agent voice cards,
 * live transcript streaming, and voice control bar.
 *
 * Phase 72, Plan 03: D-01
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { GlassPanel } from "@/components/GlassPanel";
import { SectionHeader } from "@/components/SectionHeader";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import { RoomListItem } from "@/components/RoomListItem";
import { AgentVoiceCard } from "@/components/AgentVoiceCard";
import { VoiceControlBar } from "@/components/VoiceControlBar";
import { TranscriptPanel, type TranscriptChunk } from "@/components/TranscriptPanel";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { StatusBadge } from "@/components/StatusBadge";
import { Separator } from "@/components/ui/separator";
import { WarRoomLaunchDialog } from "@/components/hr/WarRoomLaunchDialog";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { useRosterAgents } from "@/hooks/useRosterAgents";
import { resolveParticipant, resolveAgentColor } from "@/lib/warRoomIdentity";

export default function WarRoom() {
  // ─── Deep-link param (ROOM-04) ────────────────────────────────────────────
  const { roomId: deepLinkRoomId } = useParams<{ roomId?: string }>();

  // ─── State & queries ─────────────────────────────────────────────────────────
  const [closedLimit, setClosedLimit] = useState(20);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Real participant identity (ROOM-01)
  const { agents } = useRosterAgents();
  // Stable ref so transcript event callbacks always read latest agents without
  // needing to resubscribe the WebSocket listener on every roster change.
  const agentsRef = useRef(agents);
  agentsRef.current = agents;

  // Normalize to {active, closed, hasMore}. The Convex API returns this shape;
  // test mocks may return a legacy flat array — normalize for compatibility.
  const _rawRooms = useQuery(api.warRoom.listRooms, { closedLimit });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _rooms = _rawRooms as any;
  const roomsData: { active: any[]; closed: any[]; hasMore: boolean } = !_rooms
    ? { active: [], closed: [], hasMore: false }
    : Array.isArray(_rooms)
    ? {
        active: (_rooms as any[]).filter((r) => r.status === "active"),
        closed: (_rooms as any[]).filter((r) => r.status !== "active"),
        hasMore: false,
      }
    : _rooms;

  // Clear the loading-more flag once a new query result arrives (ROOM-02)
  useEffect(() => {
    if (_rawRooms !== undefined) setIsLoadingMore(false);
  }, [_rawRooms]);

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const allRooms = [...roomsData.active, ...roomsData.closed];
  const selectedRoom = allRooms.find((r) => r.roomId === selectedRoomId);
  const roomEvents =
    useQuery(
      api.warRoom.getRoomEvents,
      selectedRoomId ? { roomId: selectedRoomId } : "skip"
    ) ?? [];

  const [launchOpen, setLaunchOpen] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [liveChunks, setLiveChunks] = useState<TranscriptChunk[]>([]);
  const [speakingAgents, setSpeakingAgents] = useState<Set<string>>(new Set());
  const { subscribeEvent } = useAstridrWS();

  // ─── Deep-link auto-select (ROOM-04, Pitfall 6 guard) ────────────────────────
  // Only fires once rooms have loaded and no room is yet selected.
  // Using allRooms.length (not allRooms) as dep avoids re-firing on ref changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (deepLinkRoomId && allRooms.length > 0 && !selectedRoomId) {
      setSelectedRoomId(deepLinkRoomId);
    }
  }, [deepLinkRoomId, allRooms.length, selectedRoomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Reset state on room change ──────────────────────────────────────────────
  useEffect(() => {
    setLiveChunks([]);
    setIsJoined(false);
    setIsMuted(false);
  }, [selectedRoomId]);

  // ─── Live transcript subscription ────────────────────────────────────────────
  useEffect(() => {
    if (!selectedRoomId) return;
    const unsub = subscribeEvent("transcript.chunk", (event: Record<string, unknown>) => {
      if (event.roomId !== selectedRoomId) return;
      const speakerId = event.speakerId as string | undefined;
      setLiveChunks((prev) => [
        ...prev,
        {
          id: `${event.timestamp}-${speakerId ?? "unknown"}`,
          speaker: (event.speakerName as string) ?? "Unknown",
          speakerId,
          text: (event.text as string) ?? "",
          timestamp: (event.timestamp as number) ?? Date.now(),
          isUser: event.speakerId === "user",
          // Resolved via ref — no need to resubscribe when roster changes (ROOM-01)
          agentColor: resolveAgentColor(speakerId, agentsRef.current),
        },
      ]);
    });
    return unsub;
  }, [selectedRoomId, subscribeEvent]);

  // ─── Speaking state subscription ─────────────────────────────────────────────
  useEffect(() => {
    if (!selectedRoomId) return;
    const unsub = subscribeEvent("room.participant_speaking", (event: Record<string, unknown>) => {
      if (event.roomId !== selectedRoomId) return;
      const pid = event.participantId as string;
      setSpeakingAgents((prev) => {
        const next = new Set(prev);
        next.add(pid);
        return next;
      });
      setTimeout(() => {
        setSpeakingAgents((prev) => {
          const next = new Set(prev);
          next.delete(pid);
          return next;
        });
      }, 2000);
    });
    return unsub;
  }, [selectedRoomId, subscribeEvent]);

  // ─── Merge persisted events + live chunks for transcript ─────────────────────
  const transcriptChunks: TranscriptChunk[] = [
    ...roomEvents
      .filter((e) => e.eventType === "transcript.chunk")
      .map((e) => {
        const speakerId = (e as Record<string, unknown>).speakerId as string | undefined;
        return {
          id: e._id,
          speaker: (e as Record<string, unknown>).speakerName as string ?? "Unknown",
          speakerId,
          text: (e as Record<string, unknown>).text as string ?? "",
          timestamp: e.timestamp,
          isUser: (e as Record<string, unknown>).speakerId === "user",
          // Resolved identity color for transcript bubble styling (ROOM-01)
          agentColor: resolveAgentColor(speakerId, agents),
        };
      }),
    ...liveChunks,
  ];

  // ─── Room lists ──────────────────────────────────────────────────────────────
  const activeRooms = roomsData.active;
  const closedRooms = roomsData.closed;
  const hasMore = roomsData.hasMore;
  const handleShowMore = useCallback(() => {
    setIsLoadingMore(true);
    setClosedLimit((prev) => prev + 20);
  }, []);

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleJoin = useCallback(() => setIsJoined(true), []);
  const handleLeave = useCallback(() => setIsJoined(false), []);
  const handleToggleMute = useCallback(() => setIsMuted((m) => !m), []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">War Room</h1>
        <button
          onClick={() => setLaunchOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-base font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Room
        </button>
      </div>
      <WarRoomLaunchDialog
        open={launchOpen}
        onOpenChange={setLaunchOpen}
        initialParticipantIds={[]}
        showSaveAsTeam
      />
      <SectionErrorBoundary name="War Room">
        <div className="flex gap-4 h-[calc(100vh-140px)]">
          {/* Left panel — room list */}
          <GlassPanel className="w-64 flex-shrink-0 rounded-xl overflow-hidden flex flex-col hover:scale-[1.01] transition-transform duration-300">
            <div className="p-3">
              <SectionHeader title="Active Rooms" />
            </div>
            <div className="flex-1 overflow-y-auto">
              {activeRooms.map((room) => (
                <RoomListItem
                  key={room._id}
                  room={room}
                  isSelected={room.roomId === selectedRoomId}
                  onSelect={() => setSelectedRoomId(room.roomId)}
                />
              ))}
              {/* Empty states — mutually exclusive (ROOM-02 / UI-SPEC copywriting) */}
              {activeRooms.length === 0 && closedRooms.length === 0 ? (
                <p className="text-sm text-muted-foreground px-4 py-2">
                  No rooms yet. Launch a new room to bring agents together.
                </p>
              ) : activeRooms.length === 0 ? (
                <p className="text-sm text-muted-foreground px-4 py-2">
                  No active rooms
                </p>
              ) : null}
              {closedRooms.length > 0 && (
                <>
                  <div className="p-3 pt-4">
                    <SectionHeader title="Closed Rooms" />
                  </div>
                  {closedRooms.map((room) => (
                    <RoomListItem
                      key={room._id}
                      room={room}
                      isSelected={room.roomId === selectedRoomId}
                      onSelect={() => setSelectedRoomId(room.roomId)}
                    />
                  ))}
                  {/* Surface E: Show older rooms pagination (ROOM-02) */}
                  {hasMore && (
                    isLoadingMore ? (
                      <div className="flex items-center justify-center gap-1.5 py-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading…
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-sm text-muted-foreground w-full justify-center"
                        onClick={handleShowMore}
                      >
                        Show older rooms
                      </Button>
                    )
                  )}
                </>
              )}
            </div>
          </GlassPanel>

          {/* Right panel — room detail */}
          <GlassPanel className="flex-1 flex flex-col rounded-xl overflow-hidden hover:scale-[1.01] transition-transform duration-300">
            {selectedRoom ? (
              <>
                {/* Room header */}
                <div className="p-4 border-b border-(--border) flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{selectedRoom.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedRoom.participantIds?.length ?? 0} participants
                    </p>
                  </div>
                  <StatusBadge status={selectedRoom.status} />
                </div>

                {/* Agent cards grid */}
                <div className="p-4 grid grid-cols-2 gap-4">
                  {(selectedRoom.participantIds ?? []).map((pid: string) => {
                    // Operator self-card when pid matches the join identity (ROOM-01, D-05)
                    const identity = resolveParticipant(pid, agents, pid === "operator");
                    return (
                      <AgentVoiceCard
                        key={pid}
                        {...identity}
                        isSpeaking={speakingAgents.has(pid)}
                      />
                    );
                  })}
                </div>

                {/* Transcript */}
                <div className="flex-1 min-h-0 px-4">
                  <TranscriptPanel chunks={transcriptChunks} live={true} />
                </div>

                {/* Voice control bar */}
                <VoiceControlBar
                  isJoined={isJoined}
                  isMuted={isMuted}
                  onJoin={handleJoin}
                  onLeave={handleLeave}
                  onToggleMute={handleToggleMute}
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-base text-muted-foreground">
                  Select a room to view details.
                </p>
              </div>
            )}
          </GlassPanel>
        </div>
      </SectionErrorBoundary>
    </div>
  );
}
