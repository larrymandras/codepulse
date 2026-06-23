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
    <div className="bg-card/80 backdrop-blur border border-border/50 glow-card rounded-xl p-5 flex flex-col gap-3 hover:border-primary/50 transition-all duration-300 group shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:shadow-[0_8px_24px_rgba(16,185,129,0.15)] hover:-translate-y-1">
      <div className="flex items-start gap-4">
        <span className="text-3xl filter drop-shadow-md group-hover:scale-110 transition-transform duration-300">{categoryEmoji(entry.category)}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-foreground font-mono tracking-wide truncate group-hover:text-primary transition-colors">
            {entry.name}
          </h3>
          <span className="text-[11px] font-mono uppercase tracking-widest text-primary/80 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded mt-1 inline-block">
            {entry.category}
          </span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground/80 font-mono line-clamp-3 flex-1 mt-2 leading-relaxed">
        {entry.description}
      </p>
      <div className="flex items-center gap-2 pt-3 mt-2 border-t border-border/30">
        <button
          onClick={() => onPreview(entry)}
          className="text-sm font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          Preview
        </button>
        <button
          onClick={() => onSelect(entry)}
          className="ml-auto text-sm font-bold font-mono tracking-wider uppercase bg-primary/10 border border-primary/20 hover:bg-primary hover:text-primary-foreground text-primary px-3 py-1.5 rounded-md transition-all shadow-[0_0_10px_rgba(16,185,129,0.1)] hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]"
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
      className="bg-primary/5 backdrop-blur-sm border-2 border-dashed border-primary/30 rounded-xl p-5 flex flex-col items-center justify-center gap-3 hover:border-primary hover:bg-primary/10 transition-all duration-300 cursor-pointer min-h-[220px] shadow-inner hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] group hover:-translate-y-1"
    >
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors group-hover:scale-110 duration-300">
        <Plus className="h-6 w-6 text-primary drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
      </div>
      <div className="text-center">
        <h3 className="text-base font-bold font-mono tracking-wide text-foreground group-hover:text-primary transition-colors">Blank Agent</h3>
        <p className="text-sm font-mono tracking-widest uppercase text-muted-foreground/80 mt-2">
          Start from scratch
        </p>
      </div>
      <button className="mt-2 text-sm font-bold font-mono tracking-wider uppercase bg-primary/10 border border-primary/20 hover:bg-primary hover:text-primary-foreground text-primary px-4 py-2 rounded-md transition-all">
        Start Onboarding
      </button>
    </div>
  );
}
