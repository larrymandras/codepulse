/**
 * useAstridrChat — the conversation engine shared by the always-on Ástríðr rail
 * (and, during transition, the legacy /chat page).
 *
 * Extracted verbatim from Chat.tsx so the streaming/dedup/TTS/approval logic has
 * ONE home. Owns: messages, send, the run.text/run.blocks/run.tts/run.completed/
 * run.error WS subscriptions, TTS enable + playback, and approve/reject. UI
 * concerns (scroll, flash, skill badge, input box) stay in the consumer.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { useTtsPlayback } from "@/hooks/useTtsPlayback";
import { useApprovalActions } from "@/components/ApprovalActions";
import type { ChatMessage, GenerativeBlock } from "@/types/generative-blocks";

function generateId(): string {
  return crypto.randomUUID();
}

export function useAstridrChat() {
  const { status, sendCommand, subscribeEvent } = useAstridrWS();
  const { approve, reject } = useApprovalActions(sendCommand);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const { play: playAudio, stop: stopAudio, isPlaying: ttsIsPlaying } = useTtsPlayback();

  const activeSessionRef = useRef<string | null>(null);

  // ─── Send ────────────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming || status !== "connected") return;

      setMessages((prev) => [
        ...prev,
        { id: generateId(), role: "user", content: text, streaming: false, timestamp: Date.now() },
      ]);

      try {
        const ack = await sendCommand({ type: "chat.send", message: text });

        if (ack.status !== "ok") {
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

        const sessionId =
          (ack.session_id as string | undefined) ??
          (ack.data?.session_id as string | undefined) ??
          generateId();
        activeSessionRef.current = sessionId;

        setMessages((prev) => [
          ...prev,
          { id: generateId(), role: "assistant", content: "", streaming: true, timestamp: Date.now(), sessionId },
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
    const unsubText = subscribeEvent("run.text", (event) => {
      const data = event.data as
        | { session_id?: string; text?: string; text_chunk?: string; done?: boolean }
        | undefined;
      if (!data) return;
      const { session_id, done } = data;
      const text = data.text_chunk ?? data.text;
      if (session_id && session_id !== activeSessionRef.current) return;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.role === "assistant" && msg.streaming
            ? { ...msg, content: msg.content + (text ?? ""), streaming: done ? false : true }
            : msg
        )
      );

      if (done) {
        setIsStreaming(false);
        activeSessionRef.current = null;
      }
    });

    // run.blocks — accumulate GenerativeBlocks; approval-resolution blocks update
    // in place by requestId; identical blocks within one message are deduped
    // (the backend double-delivers run.blocks; see Chat.tsx history).
    const unsubBlocks = subscribeEvent("run.blocks", (event) => {
      const data = (event as { data?: unknown }).data ?? event;
      const payload = data as { session_id?: string; blocks?: GenerativeBlock[] };
      const blocks = payload?.blocks;
      if (!blocks || blocks.length === 0) return;

      setMessages((prev) => {
        const seenRequestIds = new Set<string>();
        for (const msg of prev) {
          for (const block of msg.blocks ?? []) {
            if (block.type === "approval") {
              seenRequestIds.add((block as { requestId: string }).requestId);
            }
          }
        }

        const updateMap = new Map<string, GenerativeBlock>();
        const appends: GenerativeBlock[] = [];
        for (const block of blocks) {
          if (block.type === "approval") {
            const requestId = (block as { requestId: string }).requestId;
            if (seenRequestIds.has(requestId)) {
              updateMap.set(requestId, block);
              continue;
            }
          }
          appends.push(block);
        }

        const updateApplied =
          updateMap.size === 0
            ? prev
            : prev.map((msg) => {
                if (!msg.blocks || msg.blocks.length === 0) return msg;
                let changed = false;
                const nextBlocks = msg.blocks.map((block) => {
                  if (block.type !== "approval") return block;
                  const requestId = (block as { requestId: string }).requestId;
                  const incoming = updateMap.get(requestId);
                  if (!incoming) return block;
                  changed = true;
                  return { ...block, ...incoming };
                });
                return changed ? { ...msg, blocks: nextBlocks } : msg;
              });

        if (appends.length === 0) return updateApplied;

        const last = updateApplied[updateApplied.length - 1];
        if (last && last.role === "assistant" && last.streaming && last.sessionId === payload.session_id) {
          const existing = last.blocks ?? [];
          const seen = new Set(existing.map((bl) => JSON.stringify(bl)));
          const fresh = appends.filter((bl) => {
            const s = JSON.stringify(bl);
            if (seen.has(s)) return false;
            seen.add(s);
            return true;
          });
          if (fresh.length === 0) return updateApplied;
          return [...updateApplied.slice(0, -1), { ...last, blocks: [...existing, ...fresh] }];
        } else {
          const seen = new Set<string>();
          const fresh = appends.filter((bl) => {
            const s = JSON.stringify(bl);
            if (seen.has(s)) return false;
            seen.add(s);
            return true;
          });
          return [
            ...updateApplied,
            {
              id: generateId(),
              role: "assistant" as const,
              blocks: fresh,
              streaming: true,
              timestamp: Date.now(),
              sessionId: payload.session_id,
            },
          ];
        }
      });
    });

    const unsubTts = subscribeEvent("run.tts", (event) => {
      const data = event.data as { session_id?: string; audio_url?: string } | undefined;
      if (!data?.audio_url) return;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.role === "assistant" && msg.sessionId && msg.sessionId === data.session_id
            ? { ...msg, audioUrl: data.audio_url }
            : msg
        )
      );
      setTtsEnabled((current) => {
        if (current) playAudio(data.audio_url!);
        return current;
      });
    });

    const unsubCompleted = subscribeEvent("run.completed", (event) => {
      const data = event.data as { session_id?: string } | undefined;
      if (data?.session_id && data.session_id !== activeSessionRef.current) return;
      setMessages((prev) => prev.map((msg) => (msg.streaming ? { ...msg, streaming: false } : msg)));
      setIsStreaming(false);
      activeSessionRef.current = null;
    });

    const unsubError = subscribeEvent("run.error", (event) => {
      const data = event.data as { session_id?: string; error?: string } | undefined;
      if (data?.session_id && data.session_id !== activeSessionRef.current) return;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.streaming
            ? {
                ...msg,
                content: msg.content + (msg.content ? "\n\n" : "") + `Error: ${data?.error ?? "Unknown error"}`,
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

  const handleApprove = useCallback((requestId: string) => approve(requestId), [approve]);
  const handleReject = useCallback(
    (requestId: string, reason?: string) => reject(requestId, reason),
    [reject]
  );

  return {
    status,
    messages,
    sendMessage,
    isStreaming,
    ttsEnabled,
    setTtsEnabled,
    playAudio,
    stopAudio,
    ttsIsPlaying,
    handleApprove,
    handleReject,
    /** Expose the active session so the voice layer (step 3) can target barge-in. */
    activeSessionRef,
  };
}
