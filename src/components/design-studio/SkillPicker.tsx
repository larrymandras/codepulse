import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSkills } from "@/lib/openDesignApi";
import type { Skill } from "@/lib/openDesignTypes";

interface SkillPickerProps {
  selectedSkillId: string | null;
  onSelect: (skillId: string) => void;
}

function SkeletonCard() {
  return (
    <div className="bg-card/60 border border-border/40 rounded-xl p-4 animate-pulse">
      <div className="space-y-2 mb-3">
        <div className="h-4 w-3/4 rounded bg-muted/50" />
        <div className="h-3 w-1/3 rounded bg-muted/50" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-muted/50" />
        <div className="h-3 w-2/3 rounded bg-muted/50" />
      </div>
    </div>
  );
}

export default function SkillPicker({ selectedSkillId, onSelect }: SkillPickerProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchSkills()
      .then((data) => {
        setSkills(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load skills");
        setLoading(false);
      });
  }, []);

  const filtered = skills.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.mode.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder={`Search ${skills.length} skills...`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 text-sm bg-card/60 border border-border/40 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
      />

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : filtered.map((skill) => (
              <div
                key={skill.id}
                onClick={() => onSelect(skill.id)}
                role="radio"
                aria-checked={selectedSkillId === skill.id}
                className={cn(
                  "bg-card/60 backdrop-blur-sm border rounded-xl p-4 flex flex-col gap-2 cursor-pointer transition-all",
                  selectedSkillId === skill.id
                    ? "border-primary/60 bg-primary/5"
                    : "border-border/40 hover:border-primary/40",
                )}
              >
                <h3 className="text-sm font-medium text-foreground">
                  {skill.name}
                </h3>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded w-fit">
                  {skill.mode}
                </span>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {skill.description}
                </p>
              </div>
            ))}
      </div>

      {!loading && !error && filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          No skills match your search
        </p>
      )}
    </div>
  );
}
