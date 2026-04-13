/**
 * Chat — full chat panel with send/receive via WebSocket, streaming responses,
 * markdown rendering, and auto-scroll with manual override.
 *
 * Phase 56, Plan 02: CPCC-01 and CPCC-02.
 */

import { useState, useEffect, useRef, useCallback, type UIEvent } from "react";
import { useAstridrWS } from "../contexts/AstridrWSContext";
import { useLiveFlash } from "@/hooks/useLiveFlash";
import { WSStatusIndicator } from "../components/WSStatusIndicator";
import { ChatBubble } from "../components/ChatBubble";
import { ChatInput } from "../components/ChatInput";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming: boolean;
  timestamp: number;
  sessionId?: string;
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Chat() {
  const { status, sendCommand, subscribeEvent } = useAstridrWS();
  const { flashRef, triggerFlash } = useLiveFlash();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

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

        // 3. Capture session_id from ack
        const sessionId = (ack.data?.session_id as string | undefined) ?? generateId();
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
        done?: boolean;
      } | undefined;

      if (!data) return;

      const { session_id, text, done } = data;
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
      unsubCompleted();
      unsubError();
    };
  }, [subscribeEvent]);

  // ─── Render ──────────────────────────────────────────────────────────────

  const isDisconnected = status !== "connected";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-(--border) shrink-0">
        <h1 className="text-base font-semibold text-(--foreground)">Chat</h1>
        <WSStatusIndicator status={status} />
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
              <p className="text-sm text-muted-foreground text-center">
                No messages yet. Send a message to start chatting with Ástríðr.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                streaming={msg.streaming}
                timestamp={msg.timestamp}
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
            className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 text-xs border border-(--border) bg-(--background) text-(--foreground) hover:bg-(--muted) transition-colors rounded-none shadow-sm"
          >
            ↓ New message
          </button>
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={isStreaming || isDisconnected}
        disconnected={isDisconnected}
      />
    </div>
  );
}
