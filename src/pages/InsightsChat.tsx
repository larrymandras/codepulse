/**
 * InsightsChat — LLM-powered Q&A over CodePulse operational data.
 *
 * Distinct from Agent Chat (which sends tasks to Ástríðr).
 * Reuses ChatBubble + BlockRenderer for consistent rendering (D-12).
 * Backend uses LLM with structured Convex tool calls (D-11).
 *
 * Phase 3, Plan 06: IL-06.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ChatBubble } from "@/components/ChatBubble";
import { ChatInput } from "@/components/ChatInput";
import { Loader2 } from "lucide-react";
import type { ChatMessage, GenerativeBlock } from "@/types/generative-blocks";

function generateId(): string {
  return crypto.randomUUID();
}

export default function InsightsChat() {
  const askInsights = useAction(api.insightsChat.ask);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or loading change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // Add user message
      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: text,
        streaming: false,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      setError(null);

      try {
        const blocks = await askInsights({ question: text });
        // Add assistant response with blocks
        const assistantMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          blocks: blocks as GenerativeBlock[],
          streaming: false,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        setError("Query failed. Try rephrasing your question.");
      } finally {
        setLoading(false);
      }
    },
    [askInsights]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-base font-semibold text-gray-100">Insights</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Ask about cost, errors, sessions, agents, or alerts.
        </p>
      </div>

      {/* Message area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !loading && (
          <p className="text-gray-500 text-sm text-center mt-8">
            Ask a question to get started.
          </p>
        )}

        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            blocks={msg.blocks}
            streaming={msg.streaming}
            timestamp={msg.timestamp}
          />
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Querying your data...
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={loading} />
    </div>
  );
}
