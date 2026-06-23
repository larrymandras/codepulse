/**
 * JumpToLatestPill — floating pill button that appears when auto-scroll
 * is paused in a transcript view. Clicking resumes auto-scroll.
 *
 * Phase 72, Plan 02: D-06
 */

import { motion, useReducedMotion, AnimatePresence } from "motion/react";

export interface JumpToLatestPillProps {
  visible: boolean;
  onClick: () => void;
}

export function JumpToLatestPill({ visible, onClick }: JumpToLatestPillProps) {
  const shouldReduce = useReducedMotion();

  return (
    <div aria-live="polite">
      <AnimatePresence>
        {visible && (
          <motion.button
            initial={shouldReduce ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={
              shouldReduce
                ? { duration: 0 }
                : { duration: 0.15, ease: "easeOut" }
            }
            onClick={onClick}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-(--accent) text-(--foreground) text-sm px-3 py-1.5 rounded-full shadow-md hover:bg-(--accent)/80 transition-colors"
          >
            Jump to latest
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
