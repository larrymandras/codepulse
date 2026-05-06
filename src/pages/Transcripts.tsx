/**
 * Transcripts — browse conversation transcripts stored as canonical events.
 *
 * Phase 095, Plan 04: TXN-04 — Transcript viewer page.
 *
 * Layout: Left panel (session list) + Right panel (chat timeline).
 * "Show raw" toggle uses session+timestamp matching (primary lookup strategy).
 */

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

// -- Types -------------------------------------------------------------------

interface CanonicalEvent {
  _id: string;
  sessionKey: string;
  eventType: string;
  role?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  rawMessageId?: string;
  schemaVersion: number;
  timestamp: number;
}

interface RawMessage {
  _id: string;
  sessionKey: string;
  channel: string;
  direction: string;
  senderId?: string;
  rawPayload: unknown;
  attachments?: unknown;
  supabaseId?: string;
  schemaVersion: number;
  timestamp: number;
}

interface SessionInfo {
  sessionKey: string;
  lastEventAt: number;
  eventCount: number;
}

// -- Helpers -----------------------------------------------------------------

/**
 * Match a canonical event to its raw message by direction + timestamp proximity.
 * This is the PRIMARY lookup strategy (not rawMessageId FK).
 */
function findMatchingRaw(
  canonicalEvent: CanonicalEvent,
  rawMessages: RawMessage[]
): RawMessage | null {
  if (
    canonicalEvent.eventType !== "message.received" &&
    canonicalEvent.eventType !== "message.sent"
  ) {
    return null;
  }
  const direction =
    canonicalEvent.eventType === "message.received" ? "inbound" : "outbound";
  const WINDOW_SECONDS = 5;
  return (
    rawMessages.find(
      (raw) =>
        raw.direction === direction &&
        Math.abs(raw.timestamp - canonicalEvent.timestamp) < WINDOW_SECONDS
    ) ?? null
  );
}

/** Format a unix timestamp (seconds) as a relative time string. */
function relativeTime(ts: number): string {
  const now = Date.now() / 1000;
  const diff = now - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Format a unix timestamp (seconds) as HH:MM:SS. */
function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Truncate a session key for display. */
function truncateKey(key: string, maxLen = 24): string {
  if (key.length <= maxLen) return key;
  return key.slice(0, maxLen - 3) + "...";
}

// -- Sub-components ----------------------------------------------------------

function SessionPicker({
  sessions,
  selectedKey,
  onSelect,
}: {
  sessions: SessionInfo[] | undefined;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  if (!sessions) {
    return (
      <div className="space-y-3 p-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-700/30 animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <p className="text-sm text-gray-500">No transcript sessions yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2 overflow-y-auto">
      {sessions.map((s) => (
        <button
          key={s.sessionKey}
          type="button"
          onClick={() => onSelect(s.sessionKey)}
          className={`w-full text-left p-3 transition-colors rounded ${
            selectedKey === s.sessionKey
              ? "bg-indigo-600/15 border-l-2 border-indigo-600"
              : "hover:bg-gray-700/30 border-l-2 border-transparent"
          }`}
        >
          <p
            className="text-sm font-mono text-gray-300 truncate"
            title={s.sessionKey}
          >
            {truncateKey(s.sessionKey)}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">
              {s.eventCount} event{s.eventCount !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-gray-600">|</span>
            <span className="text-xs text-gray-500">
              {relativeTime(s.lastEventAt)}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

function MessageReceivedBubble({
  event,
  rawMatch,
  showRaw,
  onToggleRaw,
}: {
  event: CanonicalEvent;
  rawMatch: RawMessage | null;
  showRaw: boolean;
  onToggleRaw: () => void;
}) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%]">
        <div className="bg-indigo-600/20 border border-indigo-500/20 rounded p-3">
          <p className="text-sm text-gray-200 whitespace-pre-wrap">
            {event.content ?? "(empty)"}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 mt-1">
          <button
            type="button"
            onClick={onToggleRaw}
            className="text-[10px] font-mono text-gray-500 hover:text-gray-300 transition-colors"
          >
            {showRaw ? "Hide raw" : "Raw"}
          </button>
          <span className="text-[10px] text-gray-600">
            {formatTime(event.timestamp)}
          </span>
        </div>
        {showRaw && (
          <div className="mt-2">
            {rawMatch ? (
              <pre className="bg-gray-900 border border-gray-700/50 rounded p-3 text-xs text-gray-400 font-mono max-h-60 overflow-auto whitespace-pre-wrap">
                {JSON.stringify(rawMatch.rawPayload, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-gray-600 italic">
                Raw payload not available
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageSentBubble({
  event,
  rawMatch,
  showRaw,
  onToggleRaw,
}: {
  event: CanonicalEvent;
  rawMatch: RawMessage | null;
  showRaw: boolean;
  onToggleRaw: () => void;
}) {
  const metadata = event.metadata ?? {};
  const tokensUsed = metadata.tokens_used as number | undefined;
  const costUsd = metadata.cost_usd as number | undefined;
  const model = metadata.model as string | undefined;

  return (
    <div className="flex justify-start">
      <div className="max-w-[75%]">
        <div className="bg-gray-700/50 border border-gray-600/30 rounded p-3">
          <p className="text-sm text-gray-200 whitespace-pre-wrap">
            {event.content ?? "(empty)"}
          </p>
          {/* Cost/token metadata (D-05) */}
          {(tokensUsed != null || costUsd != null || model) && (
            <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-gray-600/30">
              {tokensUsed != null && costUsd != null && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-gray-800/80 text-gray-400 rounded">
                  {tokensUsed} tokens | ${costUsd.toFixed(4)}
                </span>
              )}
              {model && (
                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-gray-800/80 text-gray-400 rounded">
                  {model}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <button
            type="button"
            onClick={onToggleRaw}
            className="text-[10px] font-mono text-gray-500 hover:text-gray-300 transition-colors"
          >
            {showRaw ? "Hide raw" : "Raw"}
          </button>
          <span className="text-[10px] text-gray-600">
            {formatTime(event.timestamp)}
          </span>
        </div>
        {showRaw && (
          <div className="mt-2">
            {rawMatch ? (
              <pre className="bg-gray-900 border border-gray-700/50 rounded p-3 text-xs text-gray-400 font-mono max-h-60 overflow-auto whitespace-pre-wrap">
                {JSON.stringify(rawMatch.rawPayload, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-gray-600 italic">
                Raw payload not available
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolCalledCard({ event }: { event: CanonicalEvent }) {
  const [expanded, setExpanded] = useState(false);
  const metadata = event.metadata ?? {};
  const args = metadata.arguments as unknown;

  return (
    <div className="border-l-2 border-amber-500 bg-amber-900/20 rounded p-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-amber-400">
          {event.content ?? "unknown_tool"}
        </span>
        <span className="text-[10px] text-gray-600">tool.called</span>
      </div>
      {args != null && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-gray-500 hover:text-gray-300 font-mono transition-colors"
          >
            {expanded ? "- Hide arguments" : "+ Show arguments"}
          </button>
          {expanded && (
            <pre className="mt-1 bg-gray-900/50 border border-gray-700/30 rounded p-2 text-xs text-gray-400 font-mono max-h-40 overflow-auto whitespace-pre-wrap">
              {JSON.stringify(args, null, 2)}
            </pre>
          )}
        </div>
      )}
      <p className="text-[10px] text-gray-600 mt-1">
        {formatTime(event.timestamp)}
      </p>
    </div>
  );
}

function ToolResultCard({ event }: { event: CanonicalEvent }) {
  const [expanded, setExpanded] = useState(false);
  const metadata = event.metadata ?? {};
  const toolName = metadata.tool_name as string | undefined;
  const content = event.content ?? "";
  const truncated = content.length > 500;

  return (
    <div className="border-l-2 border-green-500 bg-green-900/20 rounded p-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-green-400">
          {toolName ?? "unknown_tool"}
        </span>
        <span className="text-[10px] text-gray-600">tool.result</span>
      </div>
      <div className="mt-1">
        <p className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
          {expanded || !truncated ? content : content.slice(0, 500) + "..."}
        </p>
        {truncated && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-gray-500 hover:text-gray-300 font-mono transition-colors mt-1"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
      <p className="text-[10px] text-gray-600 mt-1">
        {formatTime(event.timestamp)}
      </p>
    </div>
  );
}

function ChatTimeline({
  events,
  rawMessages,
}: {
  events: CanonicalEvent[] | undefined;
  rawMessages: RawMessage[] | undefined;
}) {
  const [expandedRawIds, setExpandedRawIds] = useState<Record<string, boolean>>(
    {}
  );

  const toggleRaw = (id: string) => {
    setExpandedRawIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!events) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-gray-700/30 animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-500">
          No canonical events for this session
        </p>
      </div>
    );
  }

  const raws = rawMessages ?? [];

  return (
    <div className="space-y-4 p-4 overflow-y-auto">
      {events.map((evt) => {
        const id = evt._id;

        if (evt.eventType === "message.received") {
          const rawMatch = findMatchingRaw(evt, raws);
          return (
            <MessageReceivedBubble
              key={id}
              event={evt}
              rawMatch={rawMatch}
              showRaw={!!expandedRawIds[id]}
              onToggleRaw={() => toggleRaw(id)}
            />
          );
        }

        if (evt.eventType === "message.sent") {
          const rawMatch = findMatchingRaw(evt, raws);
          return (
            <MessageSentBubble
              key={id}
              event={evt}
              rawMatch={rawMatch}
              showRaw={!!expandedRawIds[id]}
              onToggleRaw={() => toggleRaw(id)}
            />
          );
        }

        if (evt.eventType === "tool.called") {
          return <ToolCalledCard key={id} event={evt} />;
        }

        if (evt.eventType === "tool.result") {
          return <ToolResultCard key={id} event={evt} />;
        }

        // Unknown event type -- render as generic card
        return (
          <div
            key={id}
            className="bg-gray-800/50 border border-gray-700/50 rounded p-3"
          >
            <p className="text-xs text-gray-500 font-mono">{evt.eventType}</p>
            {evt.content && (
              <p className="text-sm text-gray-300 mt-1">{evt.content}</p>
            )}
            <p className="text-[10px] text-gray-600 mt-1">
              {formatTime(evt.timestamp)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// -- Main component ----------------------------------------------------------

export default function Transcripts() {
  const [selectedSessionKey, setSelectedSessionKey] = useState<string | null>(
    null
  );

  // Session list query
  const sessions = useQuery(api.transcripts.listSessions, { limit: 50 }) as
    | SessionInfo[]
    | undefined;

  // Canonical events for selected session
  const events = useQuery(
    api.transcripts.listBySession,
    selectedSessionKey ? { sessionKey: selectedSessionKey } : "skip"
  ) as CanonicalEvent[] | undefined;

  // Raw messages for selected session (primary data source for "Show raw" toggle)
  const rawMessages = useQuery(
    api.transcripts.getRawMessagesBySession,
    selectedSessionKey ? { sessionKey: selectedSessionKey } : "skip"
  ) as RawMessage[] | undefined;

  return (
    <div className="flex h-full -m-6">
      {/* Left panel -- Session picker */}
      <div className="w-72 flex-shrink-0 border-r border-gray-700/50 bg-gray-800/30 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-gray-700/50">
          <h2 className="text-sm font-semibold text-gray-300">Sessions</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SessionPicker
            sessions={sessions}
            selectedKey={selectedSessionKey}
            onSelect={setSelectedSessionKey}
          />
        </div>
      </div>

      {/* Right panel -- Chat timeline */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-gray-700/50">
          <h2 className="text-sm font-semibold text-gray-300">
            {selectedSessionKey
              ? `Transcript: ${truncateKey(selectedSessionKey, 40)}`
              : "Transcript Viewer"}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {selectedSessionKey ? (
            <ChatTimeline events={events} rawMessages={rawMessages} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-gray-500">
                Select a session from the left panel to view its transcript
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
