/**
 * ChatInput — textarea with Enter-to-send and send button.
 *
 * - Enter submits, Shift+Enter inserts newline
 * - Auto-grows up to 4 lines
 * - Disabled while streaming or disconnected
 * - Shows disconnection warning bar when WS is not connected
 *
 * Phase 56, Plan 02: CPCC-01 chat UI.
 */

import { useState, useRef, useCallback, type KeyboardEvent, type ChangeEvent } from "react";
import { Send } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  disconnected?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatInput({ onSend, disabled = false, disconnected = false }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = value.trim().length > 0 && !disabled;

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
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
    // Auto-grow up to 4 lines (~96px)
    const el = e.target;
    el.style.height = "40px";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, []);

  return (
    <div className="flex flex-col border-t border-(--border)">
      {disconnected && (
        <div
          className="px-4 py-2 text-xs"
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
          className="flex-1 resize-none rounded-none border border-(--border) bg-(--background) text-(--foreground) text-sm px-3 py-2 outline-none placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed focus:border-(--primary) transition-colors"
          style={{ minHeight: "40px", maxHeight: "96px" }}
          aria-label="Message input"
        />

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
    </div>
  );
}

export default ChatInput;
