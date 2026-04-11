/**
 * ChatBubble — renders a single chat message bubble with markdown support.
 *
 * User messages: right-aligned, bg-[--muted]
 * Assistant messages: left-aligned, bg-[--card] with border
 * Streaming: blinking cursor appended after content
 *
 * Phase 56, Plan 02: CPCC-01 chat UI.
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Components } from "react-markdown";
import type { CSSProperties } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  timestamp?: number;
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

export function ChatBubble({ role, content, streaming = false, timestamp }: ChatBubbleProps) {
  const isUser = role === "user";

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
          ) : (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {content}
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
