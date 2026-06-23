import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  animate?: boolean; // default true; set false to opt out of entry animation
}

export function GlassPanel({ children, className, animate = true }: GlassPanelProps) {
  const shouldReduce = useReducedMotion();
  const skipMotion = !animate || shouldReduce;

  return (
    <motion.div
      initial={skipMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={skipMotion ? { duration: 0 } : { type: "spring", bounce: 0.4, duration: 0.6 }}
      className={cn(
        "bg-card border border-border relative overflow-hidden hardware-accelerated",
        "dark:bg-[var(--glass-bg)] dark:border-[var(--glass-border)] dark:backdrop-blur-[var(--glass-blur)]",
        "shadow-lg dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] dark:before:absolute dark:before:inset-0 dark:before:ring-1 dark:before:ring-inset dark:before:ring-white/5 dark:before:pointer-events-none dark:before:rounded-[inherit]",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
