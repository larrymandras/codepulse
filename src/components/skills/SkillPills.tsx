import { useState } from "react";
import { skillInvocation, topSkills, type SkillLike } from "@/lib/skills";

interface SkillPillsProps {
  skills: SkillLike[];
  /** Records the launch so useCount keeps ranking this row. */
  onUse: (skillName: string) => void;
  limit?: number;
}

/**
 * Top dock: most-used skills as pill buttons. Clicking copies the skill's invocation
 * and records the use. Dormant skills never appear — their command would do nothing.
 */
export function SkillPills({ skills, onUse, limit = 8 }: SkillPillsProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const top = topSkills(skills, limit);

  if (top.length === 0) return null;

  const handleClick = async (skill: SkillLike) => {
    const invocation = skillInvocation(skill);
    setFailed(null);
    try {
      await navigator.clipboard.writeText(invocation);
      setCopied(skill.name);
      setTimeout(() => setCopied((c) => (c === skill.name ? null : c)), 1500);
    } catch {
      // Clipboard can reject (permissions, insecure context). Say so — don't
      // claim "copied" when nothing reached the clipboard.
      setFailed(skill.name);
      setTimeout(() => setFailed((f) => (f === skill.name ? null : f)), 2500);
    }
    onUse(skill.name);
  };

  return (
    <section aria-label="Most used skills" className="flex flex-col gap-2">
      <h2 className="text-xs font-mono font-bold text-primary/70 uppercase tracking-[0.2em] flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[var(--glow-xs)]" />
        Most Used
      </h2>
      <div className="flex flex-wrap gap-2">
        {top.map((skill) => {
          const invocation = skillInvocation(skill);
          const isCopied = copied === skill.name;
          const isFailed = failed === skill.name;
          return (
            <button
              key={skill.name}
              onClick={() => handleClick(skill)}
              title={`${invocation} — click to copy${skill.useCount ? ` · used ${skill.useCount}×` : ""}`}
              aria-label={`Copy invocation ${invocation}`}
              className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-xs transition-all ${
                isFailed
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : isCopied
                    ? "border-primary bg-primary/20 text-primary shadow-[var(--glow-sm)]"
                    : "border-primary/25 bg-card text-foreground hover:border-primary hover:text-primary hover:shadow-[var(--glow-xs)]"
              }`}
            >
              <span className="truncate max-w-[16rem]">{invocation}</span>
              <span
                className={`text-[10px] tabular-nums ${isCopied || isFailed ? "" : "text-muted-foreground"}`}
              >
                {isFailed ? "copy failed" : isCopied ? "copied" : (skill.useCount ?? 0)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
