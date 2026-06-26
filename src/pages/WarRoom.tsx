/**
 * War Room page — sidebar room list + room detail with agent voice cards,
 * live transcript streaming, and voice control bar.
 *
 * Phase 72, Plan 03: D-01 initial scaffold
 * Phase 90, Plans 05-07:
 *   - Real agent identity (resolveParticipant / resolveAgentColor)
 *   - Bounded room listing + "Show older rooms" pagination
 *   - Deep-link /war-room/:roomId auto-select with race guard
 *   - Genuine LiveKit Join via useWarRoomVoice (ROOM-03)
 *   - Disconnect on room change (no audio leak, Pitfall 1)
 *   - Closed-room / non-existent deep-link read-only "Room Ended" state (ROOM-04)
 *   - Seq-ordered transcript merge with live-chunk dedup (D-07)
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { WarRoomLaunchDialog } from "@/components/hr/WarRoomLaunchDialog";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, AlertCircle } from "lucide-react";
import { useRosterAgents } from "@/hooks/useRosterAgents";
import { resolveParticipant, resolveAgentColor } from "@/lib/warRoomIdentity";
import { useWarRoomVoice } from "@/hooks/useWarRoomVoice";

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
  const [liveChunks, setLiveChunks] = useState<TranscriptChunk[]>([]);
  const [speakingAgents, setSpeakingAgents] = useState<Set<string>>(new Set());
  const { subscribeEvent } = useAstridrWS();

  // ─── Voice hook (ROOM-03) ─────────────────────────────────────────────────
  const voice = useWarRoomVoice();

  // ─── Closed-room / non-existent deep-link state (ROOM-04, Surface D) ──────
  // isRoomEnded: true when the selected room is not active, OR when a deep-link
  // roomId was set but resolves to no known room (non-existent archive link).
  const isRoomEnded = selectedRoom
    ? selectedRoom.status !== "active"
    : !!selectedRoomId;

  // Show the detail panel whenever a roomId is selected (even if no room found).
  const showDetail = !!selectedRoom || !!selectedRoomId;

  // ─── Deep-link auto-select (ROOM-04, Pitfall 6 guard) ────────────────────────
  // Only fires once rooms have loaded and no room is yet selected.
  // Using allRooms.length (not allRooms) as dep avoids re-firing on ref changes.
  useEffect(() => {
    if (deepLinkRoomId && allRooms.length > 0 && !selectedRoomId) {
      setSelectedRoomId(deepLinkRoomId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkRoomId, allRooms.length, selectedRoomId]);

  // ─── Reset live state on room change; disconnect LiveKit (T-90-LEAK) ─────────
  // voice.leave() disconnects the prior room's audio so changing rooms never
  // leaks agent audio across sessions (Pitfall 1 / T-90-LEAK mitigated).
  useEffect(() => {
    setLiveChunks([]);
    void voice.leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ─── Seq-deterministic transcript merge + live-chunk dedup (D-07) ────────────
  // Persisted roomEvents are already seq-ordered from getRoomEvents (by_room_seq index).
  // Live chunks are appended only when NOT already persisted — dedup key: timestamp+speakerId.
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
          seq: (e as Record<string, unknown>).seq as number | undefined,
          isUser: (e as Record<string, unknown>).speakerId === "user",
          // Resolved identity color for transcript bubble styling (ROOM-01)
          agentColor: resolveAgentColor(speakerId, agents),
        };
      }),
    // Exclude live chunks already committed to the persisted log (timestamp+speakerId match).
    ...liveChunks.filter((lc) =>
      !roomEvents.some(
        (e) =>
          e.timestamp === lc.timestamp &&
          (e as Record<string, unknown>).speakerId === lc.speakerId
      )
    ),
  ];

  // ─── Room lists ──────────────────────────────────────────────────────────────
  const activeRooms = roomsData.active;
  const closedRooms = roomsData.closed;
  const hasMore = roomsData.hasMore;
  const handleShowMore = useCallback(() => {
    setIsLoadingMore(true);
    setClosedLimit((prev) => prev + 20);
  }, []);

  // ─── VoiceControlBar connection state prop ────────────────────────────────────
  // VoiceControlBar.connectionState is undefined when disconnected (backward compat).
  const vcbConnectionState =
    voice.connectionState === "disconnected"
      ? undefined
      : (voice.connectionState as "connecting" | "connected" | "reconnecting" | "failed");

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
            {showDetail ? (
              <>
                {/* Room header */}
                <div className="p-4 border-b border-(--border) flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {selectedRoom?.name ?? selectedRoomId}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedRoom?.participantIds?.length ?? 0} participants
                    </p>
                  </div>
                  <StatusBadge status={selectedRoom?.status ?? "ended"} />
                </div>

                {/* Room Ended notice bar (D-06 / Surface D) — inserted between header and cards */}
                {isRoomEnded && (
                  <div className="py-2 px-4 flex items-center gap-2 bg-(--status-warn)/10 border-b border-(--status-warn)/20">
                    <AlertCircle className="h-4 w-4 text-(--status-warn)" />
                    <span className="text-sm font-medium">Room Ended</span>
                    <span className="text-sm text-muted-foreground">
                      {" — This session has ended. The transcript is preserved below."}
                    </span>
                  </div>
                )}

                {/* Agent cards grid — dimmed + non-interactive for ended rooms (Surface D) */}
                <div
                  className={`p-4 grid grid-cols-2 gap-4${isRoomEnded ? " opacity-50 pointer-events-none" : ""}`}
                >
                  {(selectedRoom?.participantIds ?? []).map((pid: string) => {
                    // Operator self-card when pid matches the join identity (ROOM-01, D-05)
                    const identity = resolveParticipant(pid, agents, pid === "operator");
                    return (
                      <AgentVoiceCard
                        key={pid}
                        {...identity}
                        isSpeaking={isRoomEnded ? false : speakingAgents.has(pid)}
                      />
                    );
                  })}
                </div>

                {/* Transcript — live={false} for ended rooms so auto-scroll is disabled */}
                <div className="flex-1 min-h-0 px-4">
                  <TranscriptPanel chunks={transcriptChunks} live={!isRoomEnded} />
                </div>

                {/* Voice control (Surface D): disabled join for ended rooms; real join for active */}
                {isRoomEnded ? (
                  /* Disabled join affordance for closed/non-existent rooms (D-06) */
                  <div className="h-16 px-6 flex flex-col items-center justify-center gap-1 border-t border-(--border)">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            data-testid="join-btn"
                            disabled
                            className="opacity-50 cursor-not-allowed px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground"
                          >
                            Join Voice
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>This room has ended</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                ) : (
                  /* Real LiveKit join via useWarRoomVoice (ROOM-03, T-90-MIC: join muted) */
                  <VoiceControlBar
                    isJoined={voice.connectionState !== "disconnected"}
                    isMuted={voice.isMuted}
                    onJoin={() => selectedRoom && void voice.join(selectedRoom.roomId)}
                    onLeave={() => void voice.leave()}
                    onToggleMute={() => void voice.toggleMute()}
                    connectionState={vcbConnectionState}
                    onRetry={() => selectedRoom && void voice.join(selectedRoom.roomId)}
                  />
                )}
              </>
            ) : (
              /* No room selected — placeholder */
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
