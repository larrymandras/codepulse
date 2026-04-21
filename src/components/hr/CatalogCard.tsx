import type { CatalogEntry } from "@/lib/astridrApi";
import { Plus } from "lucide-react";

const CATEGORY_EMOJI: Record<string, string> = {
  command: "🎖️",
  domain: "🔬",
  shared: "🔧",
  research: "📚",
  automation: "⚡",
  analysis: "📊",
  creative: "🎨",
  security: "🛡️",
  custom: "✨",
};

function categoryEmoji(category: string): string {
  return CATEGORY_EMOJI[category.toLowerCase()] ?? "🤖";
}

interface CatalogCardProps {
  entry: CatalogEntry;
  onSelect: (entry: CatalogEntry) => void;
  onPreview: (entry: CatalogEntry) => void;
}

export function CatalogCard({ entry, onSelect, onPreview }: CatalogCardProps) {
  return (
    <div className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-xl p-4 flex flex-col gap-3 hover:border-primary/40 transition-all group">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{categoryEmoji(entry.category)}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-foreground truncate">
            {entry.name}
          </h3>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
            {entry.category}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
        {entry.description}
      </p>
      <div className="flex items-center gap-2 pt-1 border-t border-border/30">
        <button
          onClick={() => onPreview(entry)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Preview
        </button>
        <button
          onClick={() => onSelect(entry)}
          className="ml-auto text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-lg transition-colors"
        >
          Onboard This Agent
        </button>
      </div>
    </div>
  );
}

const BLANK_ENTRY: CatalogEntry = {
  id: "__blank__",
  name: "Blank Agent",
  description: "",
  category: "custom",
  score: 0,
};

interface BlankAgentCardProps {
  onSelect: (entry: CatalogEntry) => void;
}

export function BlankAgentCard({ onSelect }: BlankAgentCardProps) {
  return (
    <div
      onClick={() => onSelect(BLANK_ENTRY)}
      className="bg-card/60 backdrop-blur-sm border-2 border-dashed border-border/50 rounded-xl p-4 flex flex-col items-center justify-center gap-3 hover:border-primary/40 transition-all cursor-pointer min-h-[180px]"
    >
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
        <Plus className="h-5 w-5 text-primary" />
      </div>
      <div className="text-center">
        <h3 className="text-sm font-medium text-foreground">Blank Agent</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Start from scratch
        </p>
      </div>
      <button className="text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-lg transition-colors">
        Start Onboarding
      </button>
    </div>
  );
}
