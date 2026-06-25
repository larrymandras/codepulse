/**
 * ChatInput — textarea with Enter-to-send, send button, and voice input.
 *
 * - Enter submits, Shift+Enter inserts newline
 * - Auto-grows up to 4 lines
 * - Disabled while streaming or disconnected
 * - Shows disconnection warning bar when WS is not connected
 * - Mic button for voice input via Web Speech API (hidden if unsupported)
 *
 * Phase 56, Plan 02: CPCC-01 chat UI.
 * Phase 92, Plan 02: Refactored to consume useSpeechRecognition hook.
 */

import { useState, useRef, useCallback, useEffect, type KeyboardEvent, type ChangeEvent } from "react";
import { Send, Mic, MicOff } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatInputProps {
  onSend: (message: string) => void;
  onVoiceSend?: (text: string) => void;
  disabled?: boolean;
  disconnected?: boolean;
  initialValue?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatInput({ onSend, onVoiceSend, disabled = false, disconnected = false, initialValue }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isVoiceInputRef = useRef(false);
  const initialAppliedRef = useRef(false);

  useEffect(() => {
    if (initialValue && !initialAppliedRef.current) {
      setValue(initialValue);
      initialAppliedRef.current = true;
    }
  }, [initialValue]);

  const canSend = value.trim().length > 0 && !disabled;

  // ─── Voice: handler called when speech recognition produces a final result ───

  const handleVoiceResult = useCallback(
    (transcript: string) => {
      isVoiceInputRef.current = true;
      setValue(transcript);

      // Auto-send if onVoiceSend is provided (hands-free flow)
      if (onVoiceSend) {
        onVoiceSend(transcript);
        setValue("");
        if (textareaRef.current) {
          textareaRef.current.style.height = "40px";
        }
      }
    },
    [onVoiceSend]
  );

  const { start: startListening, stop: stopListening, isListening, speechAvailable } = useSpeechRecognition({
    continuous: false,
    interimResults: false,
    onFinalResult: handleVoiceResult,
  });

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    isVoiceInputRef.current = false;
    // Reset height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = "40px";
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    isVoiceInputRef.current = false;
    // Auto-grow up to 4 lines (~96px)
    const el = e.target;
    el.style.height = "40px";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return (
    <div className="flex flex-col border-t border-(--border)">
      {disconnected && (
        <div
          className="px-4 py-2 text-sm"
          style={{
            backgroundColor: "color-mix(in oklch, var(--status-error) 10%, transparent)",
            color: "var(--status-error)",
          }}
        >
          Disconnected from Ástríðr. Reconnecting...
        </div>
      )}

      <div className="flex items-end gap-2 p-4">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Message Ástríðr..."
          rows={1}
          className="flex-1 resize-none rounded-none border border-(--border) bg-(--background) text-(--foreground) text-base px-3 py-2 outline-none placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed focus:border-(--primary) transition-colors"
          style={{ minHeight: "40px", maxHeight: "96px" }}
          aria-label="Message input"
        />

        {/* Mic button — hidden if Web Speech API is not available */}
        {speechAvailable && (
          <button
            type="button"
            onClick={toggleListening}
            disabled={disabled}
            className="flex items-center justify-center w-10 h-10 rounded-none disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
            style={{
              backgroundColor: isListening ? "var(--status-error)" : undefined,
              color: isListening ? "white" : "var(--muted-foreground)",
              border: isListening ? "none" : "1px solid var(--border)",
              animation: isListening ? "mic-pulse 1.5s ease-in-out infinite" : undefined,
            }}
            aria-label={isListening ? "Stop listening" : "Start voice input"}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        )}

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="flex items-center justify-center w-10 h-10 rounded-none disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shrink-0"
          style={{
            backgroundColor: canSend ? "var(--primary)" : undefined,
            color: canSend ? "var(--primary-foreground)" : "var(--muted-foreground)",
            border: canSend ? "none" : "1px solid var(--border)",
          }}
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Mic pulse animation */}
      <style>{`
        @keyframes mic-pulse {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in oklch, var(--status-error) 40%, transparent); }
          50% { box-shadow: 0 0 0 6px transparent; }
        }
      `}</style>
    </div>
  );
}

export default ChatInput;
