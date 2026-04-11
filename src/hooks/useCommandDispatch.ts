/**
 * useCommandDispatch — thin wrapper around useAstridrWS().sendCommand
 * that adds toast feedback via sonner for success/error states.
 *
 * Phase 56: shared command dispatch hook for all command center panels.
 */

import { useCallback } from "react";
import { toast } from "sonner";
import { useAstridrWS, type AckResponse } from "../contexts/AstridrWSContext";

export function useCommandDispatch() {
  const { sendCommand, status } = useAstridrWS();

  const dispatch = useCallback(
    async (
      cmd: Record<string, unknown>,
      successMsg?: string
    ): Promise<AckResponse> => {
      const result = await sendCommand(cmd);
      if (result.status === "ok" && successMsg) {
        toast.success(successMsg);
      }
      if (result.status === "error") {
        toast.error(result.error ?? "Command failed");
      }
      return result;
    },
    [sendCommand]
  );

  return { dispatch, isConnected: status === "connected" };
}
