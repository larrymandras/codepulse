import { Separator } from "@/components/ui/separator";

interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="space-y-2 mb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        {action}
      </div>
      <Separator />
    </div>
  );
}
