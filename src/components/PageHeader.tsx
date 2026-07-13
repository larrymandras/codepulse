import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, icon: Icon, actions, className }: PageHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-4${className ? ` ${className}` : ""}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-6 w-6" />}
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      </div>
      {actions}
    </div>
  );
}
