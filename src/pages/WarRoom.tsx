/**
 * War Room page — sidebar room list + room detail with agent voice cards,
 * live transcript streaming, and voice control bar.
 *
 * Phase 72, Plan 03: D-01
 */

import { useState, useEffect, useCallback } from "react";
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
import { Plus } from "lucide-react";

export default function WarRoom() {
  // ─── State & queries ─────────────────────────────────────────────────────────
  const rooms = useQuery(api.warRoom.listRooms) ?? [];
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const selectedRoom = rooms.find((r) => r.roomId === selectedRoomId);
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
      setLiveChunks((prev) => [
        ...prev,
        {
          id: `${event.timestamp}-${(event.speakerId as string) ?? "unknown"}`,
          speaker: (event.speakerName as string) ?? "Unknown",
          speakerId: event.speakerId as string | undefined,
          text: (event.text as string) ?? "",
          timestamp: (event.timestamp as number) ?? Date.now(),
          isUser: event.speakerId === "user",
          agentColor: undefined,
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
      .map((e) => ({
        id: e._id,
        speaker: (e as Record<string, unknown>).speakerName as string ?? "Unknown",
        speakerId: (e as Record<string, unknown>).speakerId as string | undefined,
        text: (e as Record<string, unknown>).text as string ?? "",
        timestamp: e.timestamp,
        isUser: (e as Record<string, unknown>).speakerId === "user",
      })),
    ...liveChunks,
  ];

  // ─── Room lists ──────────────────────────────────────────────────────────────
  const activeRooms = rooms.filter((r) => r.status === "active");
  const closedRooms = rooms.filter((r) => r.status !== "active");

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
          <GlassPanel className="w-64 flex-shrink-0 rounded-xl overflow-hidden flex flex-col">
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
              {activeRooms.length === 0 && (
                <p className="text-sm text-muted-foreground px-4 py-2">
                  No active rooms
                </p>
              )}
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
                </>
              )}
            </div>
          </GlassPanel>

          {/* Right panel — room detail */}
          <GlassPanel className="flex-1 flex flex-col rounded-xl overflow-hidden">
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
                  {(selectedRoom.participantIds ?? []).map((pid) => (
                    <AgentVoiceCard
                      key={pid}
                      profileId={pid}
                      name={pid}
                      avatar={null}
                      roleBadge="Agent"
                      isSpeaking={speakingAgents.has(pid)}
                    />
                  ))}
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
