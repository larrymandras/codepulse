/**
 * Meeting Bot Page — Active calls monitoring + recent calls table + inline detail.
 *
 * Phase 72, Plan 04: CPWR-03/CPWR-04
 */

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { GlassPanel } from "@/components/GlassPanel";
import { SectionHeader } from "@/components/SectionHeader";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import { StatusBadge } from "@/components/StatusBadge";
import { CallStatsBar } from "@/components/CallStatsBar";
import { TranscriptPanel, TranscriptChunk } from "@/components/TranscriptPanel";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { sendMeetingBot } from "@/lib/astridrApi";

type SortField = "startedAt" | "durationMs" | "participantCount" | "costUsd";

function formatDuration(ms?: number): string {
  if (!ms) return "\u2014";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export default function MeetingBot() {
  const activeCalls = useQuery(api.voiceCalls.listActiveCalls) ?? [];
  const recentCalls = useQuery(api.voiceCalls.listRecentCalls, { limit: 50 }) ?? [];

  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const selectedCall = [...activeCalls, ...recentCalls].find(
    (c) => c.callId === selectedCallId
  );

  const transcripts =
    useQuery(
      api.voiceCalls.getCallTranscripts,
      selectedCallId ? { callId: selectedCallId } : "skip"
    ) ?? [];

  const [sortField, setSortField] = useState<SortField>("startedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  const sortedRecentCalls = useMemo(() => {
    return [...recentCalls].sort((a, b) => {
      const aVal = ((a as Record<string, unknown>)[sortField] ?? 0) as number;
      const bVal = ((b as Record<string, unknown>)[sortField] ?? 0) as number;
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [recentCalls, sortField, sortDir]);

  const [meetingUrl, setMeetingUrl] = useState("");
  const [agentId, setAgentId] = useState("freya");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSendBot() {
    if (!meetingUrl.startsWith("https://")) {
      setSendResult({ ok: false, message: "Meeting URL must start with https://" });
      return;
    }
    setSending(true);
    setSendResult(null);
    try {
      const res = await sendMeetingBot({ meeting_url: meetingUrl, agent_id: agentId });
      setSendResult({ ok: true, message: `Bot ${res.data.bot_id} joining as ${res.data.bot_name}` });
      setMeetingUrl("");
    } catch (err: any) {
      setSendResult({ ok: false, message: err.message || "Failed to send bot" });
    } finally {
      setSending(false);
    }
  }

  const transcriptChunks: TranscriptChunk[] = transcripts.map((t) => ({
    id: t._id,
    speaker: t.speakerName ?? "Unknown",
    speakerId: t.speakerId,
    text: t.text,
    timestamp: t.timestamp,
    isUser: t.speakerId === "user",
  }));

  // Calculate word count from transcript chunks
  const wordCount = useMemo(() => {
    if (transcriptChunks.length === 0) return undefined;
    return transcriptChunks.reduce(
      (count, chunk) => count + chunk.text.split(/\s+/).filter(Boolean).length,
      0
    );
  }, [transcriptChunks]);

  function sortIndicator(field: SortField): string {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " \u2191" : " \u2193";
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Meeting Bot</h1>

      {/* Send Bot Form */}
      <SectionErrorBoundary name="Send Bot">
        <SectionHeader title="Send Bot to Meeting" />
        <Separator className="my-2" />
        <GlassPanel className="rounded-xl p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="meeting-url">Meeting URL</Label>
              <Input
                id="meeting-url"
                placeholder="https://meet.google.com/abc-defg-hij"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                disabled={sending}
              />
            </div>
            <div className="w-40 space-y-1.5">
              <Label htmlFor="agent-select">Agent</Label>
              <Select value={agentId} onValueChange={setAgentId} disabled={sending}>
                <SelectTrigger id="agent-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="freya">Freya</SelectItem>
                  <SelectItem value="astrid">Ástríðr</SelectItem>
                  <SelectItem value="hervor">Hervor</SelectItem>
                  <SelectItem value="hildr">Hildr</SelectItem>
                  <SelectItem value="gondul">Gondul</SelectItem>
                  <SelectItem value="ragnhildr">Ragnhildr</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSendBot} disabled={sending || !meetingUrl}>
              {sending ? "Sending…" : "Send Bot"}
            </Button>
          </div>
          {sendResult && (
            <p className={`text-sm mt-2 ${sendResult.ok ? "text-green-400" : "text-red-400"}`}>
              {sendResult.message}
            </p>
          )}
        </GlassPanel>
      </SectionErrorBoundary>

      {/* Active Calls Section */}
      <SectionErrorBoundary name="Active Calls">
        <SectionHeader title="Active Calls" />
        <Separator className="my-2" />
        {activeCalls.length === 0 ? (
          <GlassPanel className="rounded-xl p-8 text-center">
            <p className="text-sm text-muted-foreground">No active calls</p>
            <p className="text-xs text-muted-foreground mt-1">
              Send a bot to a meeting to monitor it here.
            </p>
          </GlassPanel>
        ) : (
          <div className="space-y-2">
            {activeCalls.map((call) => (
              <div
                key={call._id}
                className="cursor-pointer"
                onClick={() => setSelectedCallId(call.callId)}
              >
                <GlassPanel className="rounded-xl p-4 hover:bg-(--accent)/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-mono text-muted-foreground">
                        {call.callId}
                      </span>
                      {call.platform && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {call.platform}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="ping-indicator inline-block w-2 h-2 rounded-full bg-[var(--speaking-ring)]" />
                      <StatusBadge status={call.status} />
                    </div>
                  </div>
                </GlassPanel>
              </div>
            ))}
          </div>
        )}
      </SectionErrorBoundary>

      {/* Recent Calls Section */}
      <SectionErrorBoundary name="Recent Calls">
        <SectionHeader title="Recent Calls" />
        <Separator className="my-2" />
        {sortedRecentCalls.length === 0 ? (
          <GlassPanel className="rounded-xl p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No completed calls yet.
            </p>
          </GlassPanel>
        ) : (
          <GlassPanel className="rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Call ID</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("durationMs")}
                  >
                    Duration{sortIndicator("durationMs")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("participantCount")}
                  >
                    Participants{sortIndicator("participantCount")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("costUsd")}
                  >
                    Cost{sortIndicator("costUsd")}
                  </TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRecentCalls.map((call) => (
                  <TableRow
                    key={call._id}
                    className="cursor-pointer hover:bg-(--accent)/30"
                    onClick={() =>
                      setSelectedCallId(
                        selectedCallId === call.callId ? null : call.callId
                      )
                    }
                  >
                    <TableCell className="text-sm font-mono text-muted-foreground">
                      {call.callId}
                    </TableCell>
                    <TableCell className="text-sm">
                      {call.platform ?? "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {formatDuration(call.durationMs)}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {call.participantCount ?? "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-right">
                      ${(call.costUsd ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={call.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </GlassPanel>
        )}
      </SectionErrorBoundary>

      {/* Inline Call Detail */}
      {selectedCall && (
        <SectionErrorBoundary name="Call Detail">
          <GlassPanel className="rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">
                Call: {selectedCall.callId}
              </h3>
              <StatusBadge status={selectedCall.status} />
            </div>

            {/* Stats bar per D-09 */}
            <CallStatsBar
              durationMs={selectedCall.durationMs}
              participantCount={selectedCall.participantCount}
              wordCount={wordCount}
              costUsd={selectedCall.costUsd}
            />

            {/* Transcript replay per D-08 */}
            <div className="mt-4 h-[400px]">
              <TranscriptPanel chunks={transcriptChunks} live={false} />
            </div>
          </GlassPanel>
        </SectionErrorBoundary>
      )}
    </div>
  );
}
