import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface EntityRowProps {
  icon: React.ReactNode;
  primary: string;
  secondary?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
  /** When true, the primary text wraps to 2 lines (line-clamp) instead of single-line truncate. */
  wrapPrimary?: boolean;
}

export function EntityRow({ icon, primary, secondary, trailing, onClick, wrapPrimary }: EntityRowProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
      onClick={onClick}
      className={cn(
        "flex gap-3.5 px-4 py-3 border-b border-border/50 last:border-b-0 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]",
        wrapPrimary ? "items-start" : "items-center",
        onClick && "cursor-pointer hover:bg-white/[0.04] hover:pl-6 relative group"
      )}
    >
      {onClick && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary scale-y-0 group-hover:scale-y-100 transition-transform origin-center duration-300" />}
      <div className={cn("w-4 h-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary", wrapPrimary && "mt-0.5")}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p title={wrapPrimary ? undefined : primary} className={cn("text-base font-medium text-foreground/90 group-hover:text-foreground transition-colors", wrapPrimary ? "line-clamp-2" : "truncate")}>{primary}</p>
        {secondary && <p className="text-sm text-muted-foreground truncate">{secondary}</p>}
      </div>
      {trailing && <div className="shrink-0 text-sm text-muted-foreground">{trailing}</div>}
    </motion.div>
  );
}
