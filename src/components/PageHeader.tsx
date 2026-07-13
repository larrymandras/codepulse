import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, icon: Icon, actions, className }: PageHeaderProps) {
  return (
    // cn() (twMerge) so caller-passed margin overrides (mb-0, mb-0.5, …) beat
    // the baked-in mb-4 — raw concatenation loses to CSS emission order.
    <div className={cn("flex items-center justify-between mb-4", className)}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-6 w-6" />}
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      </div>
      {actions}
    </div>
  );
}
