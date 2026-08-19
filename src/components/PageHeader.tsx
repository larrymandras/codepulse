import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  icon?: LucideIcon;
  /** Optional 11px mono uppercase line above the title (design law: one eyebrow style, sketch-findings-codepulse SKILL.md). */
  eyebrow?: React.ReactNode;
  /** Optional line below the title, in muted ink. */
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  icon: Icon,
  eyebrow,
  subtitle,
  actions,
  className,
}: PageHeaderProps) {
  return (
    // cn() (twMerge) so caller-passed margin overrides (mb-0, mb-0.5, …) beat
    // the baked-in mb-4 — raw concatenation loses to CSS emission order.
    <div className={cn("flex items-center justify-between mb-4", className)}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-6 w-6" />}
        <div>
          {eyebrow && (
            <p
              data-testid="page-header-eyebrow"
              className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground"
            >
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {subtitle && (
            <p data-testid="page-header-subtitle" className="text-sm text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions}
    </div>
  );
}
