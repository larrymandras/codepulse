import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface Direction {
  title: string;
  rationale: string;
  keywords: string[];
}

interface DirectionPickerProps {
  directions: Direction[];
  loading: boolean;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

function SkeletonCard() {
  return (
    <div className="bg-card/60 border border-border/40 rounded-xl p-4 animate-pulse">
      <div className="h-5 w-2/3 bg-muted/50 rounded mb-3" />
      <div className="h-3 w-full bg-muted/50 rounded mb-2" />
      <div className="h-3 w-4/5 bg-muted/50 rounded" />
    </div>
  );
}

export default function DirectionPicker({
  directions,
  loading,
  selectedIndex,
  onSelect,
}: DirectionPickerProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {directions.map((direction, idx) => (
        <div
          key={idx}
          onClick={() => onSelect(idx)}
          role="radio"
          aria-checked={selectedIndex === idx}
          className={cn(
            "bg-card/60 backdrop-blur-sm border rounded-xl p-4 flex flex-col gap-3 cursor-pointer transition-all",
            selectedIndex === idx
              ? "border-primary/60 bg-primary/5"
              : "border-border/40 hover:border-primary/40",
          )}
        >
          <h3 className="text-base font-semibold text-foreground">
            {direction.title}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {direction.rationale}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {direction.keywords.map((kw) => (
              <Badge key={kw} variant="secondary" className="text-[10px]">
                {kw}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
