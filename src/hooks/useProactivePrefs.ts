/**
 * useProactivePrefs — focus-mode / quiet-hours state, extracted out of
 * `ControlCenterPanel.tsx` (188-13, D-18) so `QuickCommandsPanel`'s Focus
 * Mode button (mounted from `Chat.tsx` in command-center mode) writes
 * through the SAME persist call ControlCenterPanel's own `FocusModeToggle`
 * already uses — `sendCommand({ type: "config.update", section:
 * "proactive-prefs", changes: { focus_mode } })` — never a second
 * focus-mode mutation (186-09 no-parallel-path rule).
 *
 * Each caller gets its OWN hook instance (hydrate-on-mount +
 * `proactive_prefs.state` live subscription) — this mirrors the precedent
 * `useGlobalBrainOverride` (`src/hooks/useResolvedBrain.ts`) already
 * established on this exact page for the swap axis: multiple independent
 * consumers, one underlying write path, converging via the same server
 * push. `Chat.tsx` only mounts a `useProactivePrefs()` consumer inside
 * command-center mode (via `QuickCommandsContainer`), so no
 * `proactive_prefs.state` subscription opens while the mode is off.
 *
 * Byte-identical logic to what `ControlCenterPanel.tsx` owned inline before
 * this plan — moved, not rewritten.
 */
import { useState, useEffect, useCallback } from "react";
import * as jsYaml from "js-yaml";
import { useAstridrWS } from "@/contexts/AstridrWSContext";

const LS_FOCUS = "codepulse-focus-mode";

export interface ProactivePrefs {
  focus_mode: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_override: boolean | null;
}

export const DEFAULT_PROACTIVE_PREFS: ProactivePrefs = {
  focus_mode: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "06:00",
  quiet_hours_override: null,
};

/**
 * Mirrors `astridr/automation/governor.py::_compute_quiet_hours_active`
 * exactly (client-side DISPLAY only — the governor is the server-side
 * enforcement point; this uses the browser's local time as an approximation
 * of `ASTRIDR_TIMEZONE`, which is acceptable for a read-only indicator).
 */
export function isWithinQuietHours(
  prefs: ProactivePrefs,
  now: Date = new Date()
): boolean {
  if (prefs.quiet_hours_override !== null && prefs.quiet_hours_override !== undefined) {
    return prefs.quiet_hours_override;
  }
  const [startH, startM] = (prefs.quiet_hours_start ?? "").split(":").map(Number);
  const [endH, endM] = (prefs.quiet_hours_end ?? "").split(":").map(Number);
  if ([startH, startM, endH, endM].some((n) => Number.isNaN(n))) return false;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    // Same-day window (e.g. 09:00 -> 17:00).
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  // Overnight window (e.g. 22:00 -> 06:00).
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

export interface UseProactivePrefsReturn {
  prefs: ProactivePrefs;
  quietHoursActive: boolean;
  onFocusModeChange: (v: boolean) => void;
}

export function useProactivePrefs(): UseProactivePrefsReturn {
  const { sendCommand, subscribeEvent } = useAstridrWS();

  const [prefs, setPrefs] = useState<ProactivePrefs>(() => {
    try {
      const storedFocus = JSON.parse(localStorage.getItem(LS_FOCUS) ?? "false");
      return { ...DEFAULT_PROACTIVE_PREFS, focus_mode: Boolean(storedFocus) };
    } catch {
      return DEFAULT_PROACTIVE_PREFS;
    }
  });

  useEffect(() => {
    (async () => {
      try {
        const ack = await sendCommand({ type: "config.get", section: "proactive-prefs" });
        if (ack.status === "ok") {
          const content = ((ack.data as Record<string, unknown>)?.content ??
            (ack as Record<string, unknown>).content ??
            "") as string;
          const parsed = (jsYaml.load(content) as Partial<ProactivePrefs>) ?? {};
          setPrefs((prev) => ({ ...prev, ...parsed }));
          if (typeof parsed.focus_mode === "boolean") {
            localStorage.setItem(LS_FOCUS, JSON.stringify(parsed.focus_mode));
          }
        } else {
          console.warn("Failed to hydrate proactive prefs from server:", ack.error);
        }
      } catch (err) {
        console.warn("Failed to hydrate proactive prefs from server:", err);
      }
    })();
    // Mount-only hydration — sendCommand identity is stable per AstridrWSContext.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live convergence: a spoken "focus mode on/off"/"good night"/"I'm up"
  // verb (186-03) persists to the SAME config file server-side — the
  // chat.send fast-path pushes it back so every open consumer updates
  // without a reload.
  useEffect(() => {
    const unsub = subscribeEvent("proactive_prefs.state", (event) => {
      const data = (event as { data?: Partial<ProactivePrefs> }).data;
      if (!data) return;
      setPrefs((prev) => ({ ...prev, ...data }));
      if (typeof data.focus_mode === "boolean") {
        localStorage.setItem(LS_FOCUS, JSON.stringify(data.focus_mode));
      }
    });
    return unsub;
  }, [subscribeEvent]);

  const onFocusModeChange = useCallback(
    (v: boolean) => {
      setPrefs((prev) => ({ ...prev, focus_mode: v }));
      localStorage.setItem(LS_FOCUS, JSON.stringify(v));
      sendCommand({
        type: "config.update",
        request_id: crypto.randomUUID(),
        section: "proactive-prefs",
        changes: { focus_mode: v },
        dry_run: false,
      })
        .then((ack) => {
          if (ack.status !== "ok") console.warn("Failed to persist focus mode:", ack.error);
        })
        .catch((err) => {
          console.warn("Failed to persist focus mode:", err);
        });
    },
    [sendCommand]
  );

  // Quiet-hours-active is a clock-window computation, not just a config
  // read — re-derive on every prefs change AND every 30s so the indicator
  // flips even if nothing else pushed an update while the window rolled over.
  const [quietHoursActive, setQuietHoursActive] = useState(() => isWithinQuietHours(prefs));
  useEffect(() => {
    setQuietHoursActive(isWithinQuietHours(prefs));
    const id = setInterval(() => setQuietHoursActive(isWithinQuietHours(prefs)), 30_000);
    return () => clearInterval(id);
  }, [prefs]);

  return { prefs, quietHoursActive, onFocusModeChange };
}
