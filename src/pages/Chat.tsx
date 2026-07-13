/**
 * Chat — full chat panel with send/receive via WebSocket, streaming responses,
 * markdown rendering, auto-scroll with manual override, and TTS playback.
 *
 * Phase 56, Plan 02: CPCC-01 and CPCC-02.
 * Phase 92, Plan 02: Refactored to consume useTtsPlayback hook.
 */

import { useState, useEffect, useRef, useCallback, type UIEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAstridrWS } from "../contexts/AstridrWSContext";
import { useLiveFlash } from "@/hooks/useLiveFlash";
import { useTtsPlayback } from "@/hooks/useTtsPlayback";
import { WSStatusIndicator } from "../components/WSStatusIndicator";
import { ChatBubble } from "../components/ChatBubble";
import { ChatInput } from "../components/ChatInput";
import { Volume2, VolumeX } from "lucide-react";
import { useApprovalActions } from "@/components/ApprovalActions";
import { PageHeader } from "@/components/PageHeader";
import type { ChatMessage, GenerativeBlock } from "@/types/generative-blocks";

// ─── Helper ───────────────────────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Chat() {
  const { status, sendCommand, subscribeEvent } = useAstridrWS();
  const { flashRef, triggerFlash } = useLiveFlash();
  const { approve, reject } = useApprovalActions(sendCommand);

  const [searchParams, setSearchParams] = useSearchParams();

  const skillParam = searchParams.get("skill");
  const [skillBadge, setSkillBadge] = useState<string | null>(null);

  useEffect(() => {
    if (skillParam) {
      setSkillBadge(skillParam);
      setSearchParams({}, { replace: true });
    }
  }, [skillParam, setSearchParams]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // TTS state
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const { play: playAudio, stop: stopAudio, isPlaying: ttsIsPlaying } = useTtsPlayback();

  // Track active session for routing streaming events
  const activeSessionRef = useRef<string | null>(null);

  // Scroll container ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ─── Scroll helpers ──────────────────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const isNearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 10;
    setAutoScroll(isNearBottom);
  }, []);

  // Auto-scroll to bottom when messages change or streaming content appends
  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [messages, autoScroll, scrollToBottom]);

  // ─── Send ────────────────────────────────────────────────────────────────

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming || status !== "connected") return;

      // 1. Add user message
      const userMsgId = generateId();
      setMessages((prev) => [
        ...prev,
        {
          id: userMsgId,
          role: "user",
          content: text,
          streaming: false,
          timestamp: Date.now(),
        },
      ]);
      setAutoScroll(true);

      try {
        // 2. Send command to Ástríðr
        const ack = await sendCommand({ type: "chat.send", message: text });

        if (ack.status !== "ok") {
          // Show error as assistant message
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              role: "assistant",
              content: `Error: ${ack.error ?? "Command failed"}`,
              streaming: false,
              timestamp: Date.now(),
            },
          ]);
          return;
        }

        // 3. Capture session_id from ack (top-level field, or fallback to data.session_id)
        const sessionId = (ack.session_id as string | undefined)
          ?? (ack.data?.session_id as string | undefined)
          ?? generateId();
        activeSessionRef.current = sessionId;

        // 4. Add empty streaming assistant message
        const assistantMsgId = generateId();
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: "assistant",
            content: "",
            streaming: true,
            timestamp: Date.now(),
            sessionId,
          },
        ]);
        setIsStreaming(true);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: "assistant",
            content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
            streaming: false,
            timestamp: Date.now(),
          },
        ]);
      }
    },
    [isStreaming, status, sendCommand]
  );

  // ─── Receive (streaming events) ──────────────────────────────────────────

  useEffect(() => {
    // Subscribe to run.text streaming events
    const unsubText = subscribeEvent("run.text", (event) => {
      const data = event.data as {
        session_id?: string;
        text?: string;
        text_chunk?: string;
        done?: boolean;
      } | undefined;

      if (!data) return;

      const { session_id, done } = data;
      const text = data.text_chunk ?? data.text;
      if (session_id && session_id !== activeSessionRef.current) return;

      triggerFlash();

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.role === "assistant" && msg.streaming) {
            const updated = {
              ...msg,
              content: msg.content + (text ?? ""),
              streaming: done ? false : true,
            };
            return updated;
          }
          return msg;
        })
      );

      if (done) {
        setIsStreaming(false);
        activeSessionRef.current = null;
      }
    });

    // run.blocks — accumulate GenerativeBlocks into assistant messages.
    // The backend emits the plural, array-shaped event (loop.py:1440,
    // post_turn_pipeline.py:437) — the old singular "run.block" was never
    // emitted, so this path was dead code until the T-96-13-02 alignment.
    const unsubBlocks = subscribeEvent("run.blocks", (event) => {
      // Support both envelope shape (event.data) and flat shape (event
      // itself), like the approval_request handler in Inbox.tsx.
      const data = (event as { data?: unknown }).data ?? event;
      const payload = data as { session_id?: string; blocks?: GenerativeBlock[] };
      const blocks = payload?.blocks;
      if (!blocks || blocks.length === 0) return;

      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === "assistant" && last.streaming && last.sessionId === payload.session_id) {
          // Append every block to the existing assistant message
          return [
            ...prev.slice(0, -1),
            { ...last, blocks: [...(last.blocks ?? []), ...blocks] },
          ];
        } else {
          // Seed a new assistant message with the block array
          return [
            ...prev,
            {
              id: generateId(),
              role: "assistant" as const,
              blocks: [...blocks],
              streaming: true,
              timestamp: Date.now(),
              sessionId: payload.session_id,
            },
          ];
        }
      });
    });

    // run.tts — attach audio URL to the matching assistant message and auto-play
    const unsubTts = subscribeEvent("run.tts", (event) => {
      const data = event.data as {
        session_id?: string;
        audio_url?: string;
      } | undefined;

      if (!data?.audio_url) return;

      // Attach audioUrl to the matching message by sessionId.
      // URL normalization (relative → absolute) is handled inside useTtsPlayback.
      setMessages((prev) =>
        prev.map((msg) => {
          if (
            msg.role === "assistant" &&
            msg.sessionId &&
            msg.sessionId === data.session_id
          ) {
            return { ...msg, audioUrl: data.audio_url };
          }
          return msg;
        })
      );

      // Auto-play if TTS is enabled (ttsEnabled guard stays in Chat — the hook is transport-agnostic)
      setTtsEnabled((current) => {
        if (current) {
          playAudio(data.audio_url!);
        }
        return current;
      });
    });

    // run.completed — safety net to stop streaming
    const unsubCompleted = subscribeEvent("run.completed", (event) => {
      const data = event.data as { session_id?: string } | undefined;
      if (data?.session_id && data.session_id !== activeSessionRef.current) return;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.streaming ? { ...msg, streaming: false } : msg
        )
      );
      setIsStreaming(false);
      activeSessionRef.current = null;
    });

    // run.error — stop streaming, show error
    const unsubError = subscribeEvent("run.error", (event) => {
      const data = event.data as { session_id?: string; error?: string } | undefined;
      if (data?.session_id && data.session_id !== activeSessionRef.current) return;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.streaming
            ? {
                ...msg,
                content:
                  msg.content + (msg.content ? "\n\n" : "") +
                  `Error: ${data?.error ?? "Unknown error"}`,
                streaming: false,
              }
            : msg
        )
      );
      setIsStreaming(false);
      activeSessionRef.current = null;
    });

    return () => {
      unsubText();
      unsubBlocks();
      unsubTts();
      unsubCompleted();
      unsubError();
    };
  }, [subscribeEvent, playAudio]);

  // ─── Approve/Reject handlers for approval blocks ─────────────────────────
  // Delegates to the shared ApprovalActions hook (D-11) so Chat and Inbox
  // send the identical, server-correct { request_id_target, decision }
  // payload and both await the ack before toasting (T-96-03-01 fix). The
  // hook never throws — it catches sendCommand rejections (error ack /
  // timeout / queue-full), toasts, and resolves false. The boolean is
  // forwarded so ApprovalBlock only flips to approved/rejected on true.

  const handleApprove = useCallback(
    (requestId: string) => approve(requestId),
    [approve]
  );

  const handleReject = useCallback(
    (requestId: string, reason?: string) => reject(requestId, reason),
    [reject]
  );

  // ─── Voice send handler (auto-send after speech recognition) ─────────────

  const handleVoiceSend = useCallback(
    (text: string) => {
      void handleSend(text);
    },
    [handleSend]
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  const isDisconnected = status !== "connected";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="p-4 border-b border-(--border) shrink-0">
        <PageHeader
          title="Chat"
          actions={
            <div className="flex items-center gap-3">
              {/* TTS toggle */}
              <button
                type="button"
                onClick={() => {
                  setTtsEnabled((prev) => {
                    const next = !prev;
                    if (!next && ttsIsPlaying) {
                      stopAudio();
                    }
                    return next;
                  });
                }}
                className="flex items-center justify-center w-8 h-8 rounded-none transition-colors"
                style={{
                  color: ttsEnabled ? "var(--primary)" : "var(--muted-foreground)",
                  border: "1px solid var(--border)",
                  backgroundColor: ttsEnabled
                    ? "color-mix(in oklch, var(--primary) 10%, transparent)"
                    : undefined,
                }}
                aria-label={ttsEnabled ? "Disable auto-TTS" : "Enable auto-TTS"}
                title={ttsEnabled ? "Auto-TTS enabled" : "Auto-TTS disabled"}
              >
                {ttsEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
              </button>
              <WSStatusIndicator status={status} />
            </div>
          }
        />
      </header>

      {/* Message list */}
      <div ref={flashRef} className="flex-1 overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="h-full overflow-y-auto p-4 space-y-3"
          onScroll={handleScroll}
        >
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-base text-muted-foreground text-center">
                No messages yet. Send a message to start chatting with Ástríðr.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                blocks={msg.blocks}
                streaming={msg.streaming}
                timestamp={msg.timestamp}
                audioUrl={msg.audioUrl}
                onPlayAudio={playAudio}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))
          )}
        </div>
      </div>

      {/* New message floating button (shown when auto-scroll suppressed) */}
      {!autoScroll && messages.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setAutoScroll(true);
              scrollToBottom();
            }}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 text-sm border border-(--border) bg-(--background) text-(--foreground) hover:bg-(--muted) transition-colors rounded-none shadow-sm"
          >
            ↓ New message
          </button>
        </div>
      )}

      {/* Input */}
      {skillBadge && (
        <div className="flex items-center gap-2 px-4 pb-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-sm text-indigo-300">
            Skill: {skillBadge}
            <button
              onClick={() => setSkillBadge(null)}
              className="hover:text-white ml-1"
            >
              &times;
            </button>
          </span>
        </div>
      )}
      <ChatInput
        onSend={handleSend}
        onVoiceSend={handleVoiceSend}
        disabled={isStreaming || isDisconnected}
        disconnected={isDisconnected}
        initialValue={skillBadge ? `/${skillBadge}` : undefined}
      />
    </div>
  );
}
