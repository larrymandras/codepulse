/**
 * Memory source badge — shows whether memory came from episodic or mem0 (per D-07, MEM0-01).
 * Displayed in Agent Detail panel next to memory entries.
 */
interface MemorySourceBadgeProps {
  source: "episodic" | "mem0" | "hybrid" | "solution";
  className?: string;
}

const SOURCE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  episodic: { bg: "bg-blue-100", text: "text-blue-700", label: "Episodic" },
  mem0: { bg: "bg-purple-100", text: "text-purple-700", label: "mem0" },
  hybrid: { bg: "bg-amber-100", text: "text-amber-700", label: "Hybrid" },
  solution: { bg: "bg-green-100", text: "text-green-700", label: "Solution" },
};

export function MemorySourceBadge({ source, className = "" }: MemorySourceBadgeProps) {
  const style = SOURCE_STYLES[source] ?? SOURCE_STYLES.episodic;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${style.bg} ${style.text} ${className}`}
    >
      {style.label}
    </span>
  );
}
