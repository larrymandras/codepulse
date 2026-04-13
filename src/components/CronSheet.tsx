import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import CronBuilder from "./CronBuilder";

interface CronSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editJob?: { name: string; expression: string } | null;
  onSave: (name: string, expression: string) => void;
}

export default function CronSheet({
  open,
  onOpenChange,
  editJob,
  onSave,
}: CronSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px]">
        <SheetHeader>
          <SheetTitle>{editJob ? "Edit Cron Job" : "Create Cron Job"}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 px-4">
          <CronBuilder
            initialName={editJob?.name}
            initialExpression={editJob?.expression}
            onSave={(name, expr) => {
              onSave(name, expr);
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
