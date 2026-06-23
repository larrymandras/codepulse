/**
 * Chat — full chat panel with send/receive via WebSocket, streaming responses,
 * markdown rendering, auto-scroll with manual override, and TTS playback.
 *
 * Phase 56, Plan 02: CPCC-01 and CPCC-02.
 */

import { useState, useEffect, useRef, useCallback, type UIEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAstridrWS } from "../contexts/AstridrWSContext";
import { useLiveFlash } from "@/hooks/useLiveFlash";
import { WSStatusIndicator } from "../components/WSStatusIndicator";
import { ChatBubble } from "../components/ChatBubble";
import { ChatInput } from "../components/ChatInput";
import { Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import type { ChatMessage, GenerativeBlock } from "@/types/generative-blocks";

// ─── Constants ───────────────────────────────────────────────────────────────

const ASTRIDR_API_URL = import.meta.env.VITE_ASTRIDR_API_URL ?? "http://localhost:8181";

// ─── Helper ───────────────────────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Chat() {
  const { status, sendCommand, subscribeEvent } = useAstridrWS();
  const { flashRef, triggerFlash } = useLiveFlash();

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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Track active session for routing streaming events
  const activeSessionRef = useRef<string | null>(null);

  // Scroll container ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ─── Audio helpers ───────────────────────────────────────────────────────

  const playAudio = useCallback((url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play().catch((err) => {
      console.warn("TTS playback failed:", err);
    });
    audio.onended = () => {
      audioRef.current = null;
    };
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

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

    // run.block — accumulate GenerativeBlocks into assistant messages
    const unsubBlock = subscribeEvent("run.block", (event) => {
      const data = event as { session_id: string; block: GenerativeBlock };
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === "assistant" && last.streaming && last.sessionId === data.session_id) {
          // Append block to existing assistant message
          return [
            ...prev.slice(0, -1),
            { ...last, blocks: [...(last.blocks ?? []), data.block] },
          ];
        } else {
          // Create new assistant message with block
          return [
            ...prev,
            {
              id: generateId(),
              role: "assistant" as const,
              blocks: [data.block],
              streaming: true,
              timestamp: Date.now(),
              sessionId: data.session_id,
            },
          ];
        }
      });
    });

    // run.tts — attach audio URL to the matching assistant message
    const unsubTts = subscribeEvent("run.tts", (event) => {
      const data = event.data as {
        session_id?: string;
        audio_url?: string;
      } | undefined;

      if (!data?.audio_url) return;

      // Build full URL — audio_url may be relative like /api/audio/file.mp3
      const fullUrl = data.audio_url.startsWith("http")
        ? data.audio_url
        : `${ASTRIDR_API_URL}${data.audio_url}`;

      // Attach audioUrl to the matching message by sessionId
      setMessages((prev) =>
        prev.map((msg) => {
          if (
            msg.role === "assistant" &&
            msg.sessionId &&
            msg.sessionId === data.session_id
          ) {
            return { ...msg, audioUrl: fullUrl };
          }
          return msg;
        })
      );

      // Auto-play if TTS is enabled
      // Read ttsEnabled via ref-like pattern: we close over nothing,
      // the setter callback gives us current state
      setTtsEnabled((current) => {
        if (current) {
          playAudio(fullUrl);
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
      unsubBlock();
      unsubTts();
      unsubCompleted();
      unsubError();
    };
  }, [subscribeEvent, playAudio]);

  // ─── Approve/Reject handlers for approval blocks ─────────────────────────

  const handleApprove = useCallback((requestId: string) => {
    void sendCommand({ type: "approval.respond", requestId, approved: true });
    toast.success("Approved — sent to Ástríðr");
  }, [sendCommand]);

  const handleReject = useCallback((requestId: string, reason?: string) => {
    void sendCommand({ type: "approval.respond", requestId, approved: false, reason });
    toast("Rejected");
  }, [sendCommand]);

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
    <div className="flex flex-col h-full max-h-[500px]">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-(--border) shrink-0">
        <h1 className="text-base font-semibold text-(--foreground)">Chat</h1>
        <div className="flex items-center gap-3">
          {/* TTS toggle */}
          <button
            type="button"
            onClick={() => {
              setTtsEnabled((prev) => {
                const next = !prev;
                if (!next && audioRef.current) {
                  audioRef.current.pause();
                  audioRef.current = null;
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
