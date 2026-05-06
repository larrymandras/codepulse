export type RhythmCategory = "health" | "morning" | "research" | "content" | "review" | "system";

export const CATEGORY_COLORS: Record<RhythmCategory, string> = {
  health:   "bg-teal-500/20 border-teal-500/40 text-teal-300",
  morning:  "bg-orange-500/20 border-orange-500/40 text-orange-300",
  research: "bg-blue-500/20 border-blue-500/40 text-blue-300",
  content:  "bg-purple-500/20 border-purple-500/40 text-purple-300",
  review:   "bg-red-500/20 border-red-500/40 text-red-300",
  system:   "bg-slate-500/30 border-slate-400/50 text-slate-300",
};

export function categorizeRhythm(action: string): RhythmCategory {
  const lower = action.toLowerCase();
  if (/briefing|morning|evening|weekly digest/.test(lower)) return "morning";
  if (/health.check|monitor|status.update/.test(lower)) return "health";
  if (/research|pr review|code review|pr digest/.test(lower)) return "research";
  if (/content|write|generate|create/.test(lower)) return "content";
  if (/review|audit|report/.test(lower)) return "review";
  return "system";
}
