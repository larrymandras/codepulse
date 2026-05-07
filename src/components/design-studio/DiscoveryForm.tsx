import { Textarea } from "@/components/ui/textarea";

interface DiscoveryFormProps {
  brief: string;
  onBriefChange: (value: string) => void;
  onSubmit: () => void;
}

export default function DiscoveryForm({
  brief,
  onBriefChange,
  onSubmit,
}: DiscoveryFormProps) {
  return (
    <div className="space-y-4 max-w-2xl">
      <label className="text-sm font-semibold text-foreground">
        Describe your project
      </label>
      <Textarea
        rows={6}
        placeholder="What are you building? Who is the audience? What tone or feeling?"
        value={brief}
        onChange={(e) => onBriefChange(e.target.value)}
        className="w-full resize-none"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground text-right w-full">
          {brief.length} characters
        </span>
      </div>
      <button
        disabled={!brief.trim()}
        onClick={onSubmit}
        className="mt-4 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Generate Directions
      </button>
    </div>
  );
}
