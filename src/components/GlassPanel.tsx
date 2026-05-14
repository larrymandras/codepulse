import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  animate?: boolean; // default true; set false to opt out of entry animation
  accent?: "cost" | "health" | "activity" | "memory" | "alerts";
}

export function GlassPanel({ children, className, animate = true, accent }: GlassPanelProps) {
  const shouldReduce = useReducedMotion();
  const skipMotion = !animate || shouldReduce;

  return (
    <motion.div
      initial={skipMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={skipMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
      className={cn(
        "bg-card border border-border",
        "dark:bg-[var(--glass-bg)] dark:border-[var(--glass-border)] dark:backdrop-blur-[var(--glass-blur)]",
        className
      )}
      {...(accent ? { "data-accent": accent } : {})}
    >
      {children}
    </motion.div>
  );
}
