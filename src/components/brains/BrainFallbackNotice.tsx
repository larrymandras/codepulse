/**
 * BrainFallbackNotice.tsx — 103-07-T3.
 *
 * D-04: CLI brains ship TEXT MODE ONLY this phase — the `--agentic` per-CLI-brain hybrid mode
 * (design spec D2) is deferred. A text-mode CLI brain that receives a tool-needing turn silently
 * falls back to an API model today; this hook is what keeps that degrade honest instead of silent,
 * per `103-CONTRACT.md` §5's `brain.fallback` WS event.
 *
 * Subscribes via the same `useAstridrWS().subscribeEvent(...)` idiom (and cleanup) `Chat.tsx`
 * already establishes for `"swap.state"` — a fire-and-forget WS notification, not a command with
 * an ack (§5: "No response/ack is expected").
 *
 * Warn-toned (`toast.warning`), never error-toned — a text-mode fallback answering on a different
 * model is a graceful degrade, not a failure (UI-SPEC §12, Color contract line 88). Guards a
 * malformed payload (a missing `fallback_model`, T-103-27's mitigation) so it can never fire a
 * half-formed toast — React's own JSX interpolation of the untrusted `cli_model`/`fallback_model`
 * strings keeps this XSS-safe without any manual escaping.
 *
 * Explicitly OUT of scope (UI-SPEC §12's carve-out): no `ChatBubble` changes — badging the
 * individual chat response bubble with a "(fallback)" tag is a future phase's job, not this one's.
 */

import { useEffect } from "react";
import { toast } from "sonner";
import { ArrowRightLeft } from "lucide-react";
import { useAstridrWS } from "@/contexts/AstridrWSContext";

interface BrainFallbackEventData {
  profile_id?: string;
  cli_model?: string;
  fallback_model?: string;
  reason?: string;
}

export function useBrainFallbackNotice(): void {
  const { subscribeEvent } = useAstridrWS();

  useEffect(() => {
    const unsubscribe = subscribeEvent("brain.fallback", (event) => {
      const data = (event as { data?: BrainFallbackEventData }).data;
      if (!data) return;

      const cliModel = data.cli_model;
      const fallbackModel = data.fallback_model;
      // T-103-27: a payload missing either model name never fires a half-formed toast.
      if (!cliModel || !fallbackModel) return;

      toast.warning(`${cliModel} couldn't use tools this turn — answered on ${fallbackModel} instead.`, {
        icon: <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />,
      });
    });
    return unsubscribe;
  }, [subscribeEvent]);
}
