/**
 * ChatBubble — one turn of the Ástríðr conversation.
 *
 * Assistant turns render as "transmissions" (presence-page design, 2026-07-20):
 * a luminous left rail, a tracked mono eyebrow (ÁSTRÍÐR · 9:32 AM), body ink on
 * a primary-tinted panel (.bubble-her in index.css). User turns are quiet
 * right-aligned slabs with a mono clock-time meta. Both materialize in with
 * .msg-turn (reduced-motion aware).
 *
 * Supports two rendering modes (mutually exclusive):
 *   blocks[] — Generative UI Blocks via BlockRenderer (D-04)
 *   content   — plain markdown string (backward compatible)
 *
 * Optional audioUrl prop → circular replay control with live EQ bars while
 * playing (assistant turns only).
 *
 * Phase 56, Plan 02: CPCC-01 chat UI. Phase 03, Plan 04: IL-02 blocks.
 */

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Play, Square } from "lucide-react";
import type { Components } from "react-markdown";
import { BlockRenderer } from "@/components/BlockRenderer";
import type { GenerativeBlock } from "@/types/generative-blocks";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatBubbleProps {
  role: "user" | "assistant";
  content?: string;           // optional — plain markdown string path
  blocks?: GenerativeBlock[]; // optional — Generative UI Block path (D-04)
  streaming?: boolean;
  timestamp?: number;
  audioUrl?: string;
  onPlayAudio?: (url: string) => void;
  /** Resolve true iff the server ack'd — ApprovalBlock gates its UI flip on it. */
  onApprove?: (requestId: string) => Promise<boolean>;
  onReject?: (requestId: string, reason?: string) => Promise<boolean>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Clock time ("9:32 AM") — a conversation with a presence keeps real time,
 *  not a wall of "just now". */
function formatClockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── Markdown components ──────────────────────────────────────────────────────

const markdownComponents: Components = {
  // Collapse headings to body text — no large headings inside bubbles
  h1: ({ children }) => (
    <span className="block font-semibold text-base mb-1">{children}</span>
  ),
  h2: ({ children }) => (
    <span className="block font-semibold text-base mb-1">{children}</span>
  ),
  h3: ({ children }) => (
    <span className="block font-semibold text-base mb-1">{children}</span>
  ),
  h4: ({ children }) => (
    <span className="block font-semibold text-base mb-1">{children}</span>
  ),
  h5: ({ children }) => (
    <span className="block font-semibold text-base mb-1">{children}</span>
  ),
  h6: ({ children }) => (
    <span className="block font-semibold text-base mb-1">{children}</span>
  ),
  // Code — inline vs block detection
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className?.startsWith("language-"));
    const language = className?.replace("language-", "") ?? "text";

    if (isBlock) {
      return (
        <SyntaxHighlighter
          style={oneDark}
          language={language}
          PreTag="div"
          className="font-mono text-sm rounded-none my-1"
          customStyle={{ margin: 0, borderRadius: 0, fontSize: "0.75rem" }}
        >
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
      );
    }

    return (
      <code
        className="font-mono text-sm bg-black/20 px-1 rounded-none"
        {...props}
      >
        {children}
      </code>
    );
  },
  // Paragraphs — tight spacing inside bubbles
  p: ({ children }) => (
    <p className="text-[0.925rem] leading-relaxed mb-1.5 last:mb-0">{children}</p>
  ),
  // Lists
  ul: ({ children }) => (
    <ul className="text-[0.925rem] list-disc list-inside mb-1 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="text-[0.925rem] list-decimal list-inside mb-1 space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => <li className="text-[0.925rem]">{children}</li>,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatBubble({
  role,
  content,
  blocks,
  streaming = false,
  timestamp,
  audioUrl,
  onPlayAudio,
  onApprove,
  onReject,
}: ChatBubbleProps) {
  const isUser = role === "user";
  const [isPlaying, setIsPlaying] = useState(false);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup local audio on unmount
  useEffect(() => {
    return () => {
      if (localAudioRef.current) {
        localAudioRef.current.pause();
        localAudioRef.current = null;
      }
    };
  }, []);

  const handlePlayToggle = () => {
    if (!audioUrl) return;

    if (onPlayAudio) {
      // Delegate to parent (Chat.tsx manages shared audio)
      onPlayAudio(audioUrl);
      return;
    }

    // Local playback fallback
    if (isPlaying && localAudioRef.current) {
      localAudioRef.current.pause();
      localAudioRef.current = null;
      setIsPlaying(false);
      return;
    }

    const audio = new Audio(audioUrl);
    localAudioRef.current = audio;
    setIsPlaying(true);
    audio.play().catch(() => setIsPlaying(false));
    audio.onended = () => {
      setIsPlaying(false);
      localAudioRef.current = null;
    };
  };

  const time = timestamp !== undefined ? formatClockTime(timestamp) : null;

  // ─── User turn — quiet right slab ──────────────────────────────────────────
  if (isUser) {
    return (
      <div className="msg-turn flex flex-col items-end w-full">
        <div className="bubble-you rounded-2xl max-w-[78%] px-4 py-2.5">
          <p className="text-[0.925rem] leading-relaxed whitespace-pre-wrap text-foreground/95">
            {content}
          </p>
        </div>
        {time && (
          <span className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground/80 mt-1 px-1">
            {time}
          </span>
        )}
      </div>
    );
  }

  // ─── Assistant turn — transmission ─────────────────────────────────────────
  return (
    <div className="msg-turn flex flex-col items-start w-full">
      {/* Eyebrow: who is speaking, when */}
      <div className="flex items-center gap-2 mb-1 px-1">
        <span
          className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]"
          aria-hidden="true"
        />
        <span className="font-mono text-[10px] font-semibold tracking-[0.2em] text-primary/90">
          ÁSTRÍÐR
        </span>
        {time && (
          <span className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground/80">
            · {time}
          </span>
        )}
      </div>

      <div className="bubble-her rounded-2xl max-w-[85%] px-4 py-3 text-foreground">
        {blocks && blocks.length > 0 ? (
          // Generative UI Block path (D-04)
          <div className="flex flex-col gap-2">
            {blocks.map((block, idx) => (
              <BlockRenderer
                key={idx}
                block={block}
                onApprove={onApprove}
                onReject={onReject}
              />
            ))}
            {streaming && <span className="stream-cursor" aria-hidden="true" />}
          </div>
        ) : (
          // Markdown path — backward compatible
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {content ?? ""}
            </ReactMarkdown>
            {streaming && <span className="stream-cursor" aria-hidden="true" />}
          </div>
        )}

        {/* Replay her voice — assistant turns with audio only */}
        {audioUrl && !streaming && (
          <button
            type="button"
            onClick={handlePlayToggle}
            aria-label={isPlaying ? "Stop audio" : "Replay Ástríðr's voice"}
            title={isPlaying ? "Stop" : "Replay her voice"}
            className={`mt-2.5 flex items-center gap-2 h-7 pl-1.5 pr-2.5 rounded-full border text-[11px] font-mono tracking-wide transition-colors ${
              isPlaying
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border bg-background/40 text-muted-foreground hover:text-primary hover:border-primary/40"
            }`}
          >
            <span
              className={`grid place-items-center w-4.5 h-4.5 rounded-full ${
                isPlaying ? "bg-primary/20" : "bg-muted"
              }`}
            >
              {isPlaying ? (
                <Square className="w-2.5 h-2.5" />
              ) : (
                <Play className="w-2.5 h-2.5 translate-x-[0.5px]" />
              )}
            </span>
            {isPlaying ? (
              <span className="flex items-end gap-0.5 h-3 text-primary" aria-hidden="true">
                <span className="eq-bar eq-bar-1" />
                <span className="eq-bar eq-bar-2" />
                <span className="eq-bar eq-bar-3" />
              </span>
            ) : (
              <span>REPLAY</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default ChatBubble;
