/**
 * ChatBubble — renders a single chat message bubble with markdown support.
 *
 * User messages: right-aligned, bg-[--muted]
 * Assistant messages: left-aligned, bg-[--card] with border
 * Streaming: blinking cursor appended after content
 *
 * Supports two rendering modes (mutually exclusive):
 *   blocks[] — Generative UI Blocks via BlockRenderer (D-04)
 *   content   — plain markdown string (backward compatible)
 *
 * Optional audioUrl prop for TTS playback on assistant messages.
 *
 * Phase 56, Plan 02: CPCC-01 chat UI.
 * Phase 03, Plan 04: IL-02 block rendering upgrade.
 */

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Play, Square } from "lucide-react";
import type { Components } from "react-markdown";
import type { CSSProperties } from "react";
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
  onApprove?: (requestId: string) => void;
  onReject?: (requestId: string, reason?: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Markdown components ──────────────────────────────────────────────────────

const markdownComponents: Components = {
  // Collapse headings to body text — no large headings inside bubbles
  h1: ({ children }) => (
    <span className="block font-semibold text-sm mb-1">{children}</span>
  ),
  h2: ({ children }) => (
    <span className="block font-semibold text-sm mb-1">{children}</span>
  ),
  h3: ({ children }) => (
    <span className="block font-semibold text-sm mb-1">{children}</span>
  ),
  h4: ({ children }) => (
    <span className="block font-semibold text-sm mb-1">{children}</span>
  ),
  h5: ({ children }) => (
    <span className="block font-semibold text-sm mb-1">{children}</span>
  ),
  h6: ({ children }) => (
    <span className="block font-semibold text-sm mb-1">{children}</span>
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
          className="font-mono text-xs rounded-none my-1"
          customStyle={{ margin: 0, borderRadius: 0, fontSize: "0.75rem" }}
        >
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
      );
    }

    return (
      <code
        className="font-mono text-xs bg-black/20 px-1 rounded-none"
        {...props}
      >
        {children}
      </code>
    );
  },
  // Paragraphs — tight spacing inside bubbles
  p: ({ children }) => (
    <p className="text-sm leading-relaxed mb-1 last:mb-0">{children}</p>
  ),
  // Lists
  ul: ({ children }) => (
    <ul className="text-sm list-disc list-inside mb-1 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="text-sm list-decimal list-inside mb-1 space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => <li className="text-sm">{children}</li>,
};

// ─── Blink cursor style ───────────────────────────────────────────────────────

const blinkStyle: CSSProperties = {
  animation: "blink-cursor 1s step-end infinite",
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

  const bubbleClass = isUser
    ? "bg-(--muted) text-(--foreground) ml-auto max-w-[72%] p-3"
    : "bg-(--card) border border-(--border) text-(--foreground) mr-auto max-w-[72%] p-3";

  const wrapperClass = isUser
    ? "flex flex-col items-end w-full"
    : "flex flex-col items-start w-full";

  return (
    <>
      <style>{`
        @keyframes blink-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>

      <div className={wrapperClass}>
        <div className={bubbleClass}>
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
          ) : blocks && blocks.length > 0 ? (
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
              {streaming && (
                <span
                  className="inline-block text-sm"
                  style={blinkStyle}
                  aria-hidden="true"
                >
                  |
                </span>
              )}
            </div>
          ) : (
            // Existing markdown path — backward compatible
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {content ?? ""}
              </ReactMarkdown>
              {streaming && (
                <span
                  className="inline-block text-sm"
                  style={blinkStyle}
                  aria-hidden="true"
                >
                  |
                </span>
              )}
            </div>
          )}

          {/* TTS play button — assistant messages with audio only */}
          {!isUser && audioUrl && !streaming && (
            <button
              type="button"
              onClick={handlePlayToggle}
              className="mt-2 flex items-center gap-1 text-xs transition-colors"
              style={{ color: isPlaying ? "var(--primary)" : "var(--muted-foreground)" }}
              aria-label={isPlaying ? "Stop audio" : "Play audio"}
            >
              {isPlaying ? (
                <Square className="w-3 h-3" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              <span>{isPlaying ? "Stop" : "Play"}</span>
            </button>
          )}
        </div>

        {timestamp !== undefined && (
          <span className="text-xs text-muted-foreground mt-0.5 px-1">
            {formatRelativeTime(timestamp)}
          </span>
        )}
      </div>
    </>
  );
}

export default ChatBubble;
