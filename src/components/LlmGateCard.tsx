/**
 * LlmGateCard — LLM Gate toggle card for the Infrastructure page.
 *
 * Displays the current state of the LLM processing gate (enabled/disabled)
 * with a toggle switch that sends WS commands to Astridr. Persistent state
 * is served from the Convex llmGateEvents table.
 *
 * Phase 099 Plan 04 (D-11, ROUTE-05).
 */

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { useAstridrWS } from "../contexts/AstridrWSContext";
import { Switch } from "./ui/switch";
import { SectionHeader } from "./SectionHeader";
import { GlassPanel } from "./GlassPanel";
import { formatRelativeTime } from "../lib/time";

export default function LlmGateCard() {
  const { sendCommand, status } = useAstridrWS();
  const latestGateEvent = useQuery(api.llmGateEvents.latest);
  const [pendingToggle, setPendingToggle] = useState(false);

  // Derived state
  const isWsConnected = status === "connected";
  const gateEnabled = latestGateEvent?.enabled ?? true;
  const gateReason = latestGateEvent?.reason ?? "";
  const queuedCount = latestGateEvent?.queuedCount ?? 0;
  const lastToggledAt = latestGateEvent?.timestamp;

  const handleToggle = async (checked: boolean) => {
    setPendingToggle(true);
    try {
      const result = await sendCommand({
        type: checked ? "llm_gate.enable" : "llm_gate.disable",
        ...(checked ? {} : { reason: "manual" }),
      });
      if (result.status === "ok") {
        toast.success(
          checked
            ? "LLM gate enabled. Queued messages will replay."
            : "LLM gate disabled. Incoming messages will be queued."
        );
      } else {
        toast.error(result.error ?? "LLM gate command failed. Check connection and retry.");
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "LLM gate command failed. Check connection and retry."
      );
    } finally {
      setPendingToggle(false);
    }
  };

  return (
    <>
      <SectionHeader title="LLM Gate" />
      <GlassPanel className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: status + metadata */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  gateEnabled
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {gateEnabled ? "ENABLED" : "DISABLED"}
              </span>
              <span className="text-sm font-medium text-foreground">
                LLM processing
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {!isWsConnected
                ? "Not connected to Ástríðr"
                : lastToggledAt
                  ? `Changed ${formatRelativeTime(lastToggledAt)}`
                  : "Never toggled"}
            </p>
            {!gateEnabled && gateReason && (
              <p className="text-xs font-mono text-muted-foreground mt-1">
                {gateReason}
              </p>
            )}
          </div>
          {/* Right: Switch control */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">
              {pendingToggle ? "Updating..." : gateEnabled ? "On" : "Off"}
            </span>
            <Switch
              checked={gateEnabled}
              onCheckedChange={handleToggle}
              disabled={!isWsConnected || pendingToggle}
              aria-label="Toggle LLM gate"
            />
          </div>
        </div>
        {/* Queued message count — only when gate is off */}
        {!gateEnabled && queuedCount > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {queuedCount} message{queuedCount !== 1 ? "s" : ""} queued — will
              replay when gate is re-enabled
            </p>
          </div>
        )}
      </GlassPanel>
    </>
  );
}
