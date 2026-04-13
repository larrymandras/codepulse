/**
 * useLiveFlash — reusable flash animation trigger hook.
 *
 * Adds "live-update-flash" CSS class to a ref'd element when triggerFlash is called.
 * Removes the class after 620ms (matches animation duration).
 * Debounced: will not re-flash within 1 second of the previous flash (D-03, T-02-06).
 *
 * Phase 02: D-03
 */

import { useRef, useCallback } from "react";

export function useLiveFlash<T extends HTMLElement = HTMLDivElement>() {
  const flashRef = useRef<T>(null);
  const lastFlashRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerFlash = useCallback(() => {
    const el = flashRef.current;
    if (!el) return;
    const now = Date.now();
    if (now - lastFlashRef.current < 1000) return; // debounce: 1s
    lastFlashRef.current = now;
    el.classList.remove("live-update-flash");
    void el.offsetWidth; // Force reflow to restart animation
    el.classList.add("live-update-flash");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      el?.classList.remove("live-update-flash");
    }, 620);
  }, []);

  return { flashRef, triggerFlash };
}
