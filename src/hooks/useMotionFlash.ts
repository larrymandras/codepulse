import { useAnimate } from "motion/react";
import { useCallback, useRef } from "react";

/**
 * useMotionFlash — motion-based highlight flash for real-time data arrival.
 *
 * Extends the useLiveFlash pattern with motion library animation.
 * Applies a brief background-color highlight pulse (var(--glass-border) at 0.3 opacity
 * for 300ms) when triggerFlash is called. Debounced: will not re-flash within 1 second.
 *
 * Per D-07: highlight flash on new real-time items.
 * Per D-08: respects prefers-reduced-motion (checked via matchMedia).
 *
 * Usage:
 *   const [scope, triggerFlash] = useMotionFlash();
 *   <div ref={scope}> ... </div>
 *   // Call triggerFlash() when new data arrives
 */
export function useMotionFlash() {
  const [scope, animate] = useAnimate();
  const lastFlashRef = useRef(0);

  const triggerFlash = useCallback(() => {
    const now = Date.now();
    if (now - lastFlashRef.current < 1000) return; // debounce: 1s (matches useLiveFlash)
    lastFlashRef.current = now;

    // Respect prefers-reduced-motion (D-08)
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    animate(
      scope.current,
      {
        backgroundColor: [
          "var(--glass-border)", // flash color at start
          "transparent",         // fade back to transparent
        ],
      },
      { duration: 0.3, ease: "easeOut" }
    );
  }, [animate, scope]);

  return [scope, triggerFlash] as const;
}
