/**
 * useCommandCatalog — subscribes to Ástríðr WebSocket commands.catalog events
 * and returns the live command registry with connection state.
 *
 * Commands arrive over WebSocket (not Convex) to reflect the live registry
 * from Ástríðr. State is cleared on disconnect.
 */

import { useState, useEffect } from "react";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import type { CommandEntry } from "@/types/commands";

export type CommandCatalogStatus = "loading" | "ready" | "error";

export interface UseCommandCatalogResult {
  commands: CommandEntry[];
  status: CommandCatalogStatus;
  error?: string;
}

export function useCommandCatalog(): UseCommandCatalogResult {
  const { status: wsStatus, subscribeEvent } = useAstridrWS();
  const [commands, setCommands] = useState<CommandEntry[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<CommandCatalogStatus>("loading");
  const [error, setError] = useState<string | undefined>(undefined);

  // Handle WebSocket connection state changes
  useEffect(() => {
    if (wsStatus === "connected") {
      // Still waiting for catalog push — stay in loading unless we already have data
      setCatalogStatus((prev) => (prev === "ready" ? "ready" : "loading"));
      setError(undefined);
    } else if (wsStatus === "reconnecting") {
      // Clear stale data and show loading during reconnect
      setCommands([]);
      setCatalogStatus("loading");
      setError(undefined);
    } else if (wsStatus === "disconnected") {
      // Clear state and show error
      setCommands([]);
      setCatalogStatus("error");
      setError("Registry unavailable. Connect to Ástríðr to load the command catalog.");
    }
  }, [wsStatus]);

  // Subscribe to commands.catalog events
  useEffect(() => {
    const unsubscribe = subscribeEvent("commands.catalog", (msg) => {
      // T-58-01: Validate incoming payload before setting state
      const data = msg.data as Record<string, unknown> | undefined;

      if (!data || !Array.isArray(data.tools)) {
        // Malformed payload — ignore
        return;
      }

      // Extract tools array (primary source)
      const tools = data.tools as CommandEntry[];

      // Optionally include pipes and commands arrays with category markers
      const pipes: CommandEntry[] = Array.isArray(data.pipes)
        ? (data.pipes as CommandEntry[]).map((p) => ({ ...p, category: p.category ?? "pipes" }))
        : [];

      const cmds: CommandEntry[] = Array.isArray(data.commands)
        ? (data.commands as CommandEntry[]).map((c) => ({
            ...c,
            category: c.category ?? "commands",
          }))
        : [];

      setCommands([...tools, ...pipes, ...cmds]);
      setCatalogStatus("ready");
      setError(undefined);
    });

    return unsubscribe;
  }, [subscribeEvent]);

  return { commands, status: catalogStatus, error };
}
