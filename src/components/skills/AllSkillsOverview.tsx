import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { SkillRow, type RowSkill } from "./SkillRow";
import { categoryHex } from "@/lib/categoryColors";

export type OverviewSkill = RowSkill & { categoryName: string | null };

export interface OverviewCategory {
  name: string;
  displayName: string;
  icon: string;
  color: string;
}

interface AllSkillsOverviewProps {
  /** Already filtered by the page: non-hidden + origin filter + search. */
  skills: OverviewSkill[];
  categories: OverviewCategory[];
  onSelectCategory: (name: string) => void;
  onRecordUse: (skillName: string) => void;
  onOpenInChat: (skillName: string) => void;
  onEdit: (skillName: string) => void;
  onToggleFavorite: (skillName: string) => void;
}

const PREVIEW_COUNT = 8;

/** The default main view: every category as a section, uncategorized last. */
export function AllSkillsOverview({
  skills,
  categories,
  onSelectCategory,
  onRecordUse,
  onOpenInChat,
  onEdit,
  onToggleFavorite,
}: AllSkillsOverviewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const byCat = new Map<string, OverviewSkill[]>();
    for (const s of skills) {
      const key = s.categoryName ?? "";
      const list = byCat.get(key);
      if (list) list.push(s);
      else byCat.set(key, [s]);
    }
    const catByName = new Map(categories.map((c) => [c.name, c]));
    const named = [...byCat.entries()]
      .filter(([key]) => key !== "")
      .map(([key, list]) => ({ key, cat: catByName.get(key) ?? null, list }))
      .sort((a, b) => b.list.length - a.list.length);
    return { named, uncategorized: byCat.get("") ?? [] };
  }, [skills, categories]);

  if (skills.length === 0) {
    return (
      <div className="text-center font-mono text-sm tracking-widest text-muted-foreground py-8 border border-dashed border-primary/20 rounded bg-primary/5">
        [ NO SKILLS MATCH ]
      </div>
    );
  }

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const renderList = (key: string, list: OverviewSkill[]) => {
    const isExpanded = expanded.has(key);
    const shown = isExpanded ? list : list.slice(0, PREVIEW_COUNT);
    return (
      <>
        <div className="flex flex-col divide-y divide-primary/10 border-t border-b border-primary/20 bg-background/30">
          {shown.map((skill) => (
            <SkillRow
              key={skill.name}
              skill={skill}
              onRecordUse={onRecordUse}
              onOpenInChat={onOpenInChat}
              onEdit={onEdit}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
        {list.length > PREVIEW_COUNT && (
          <button
            onClick={() => toggle(key)}
            className="self-start mt-1 inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-widest text-primary/60 hover:text-primary transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronDown className="w-3 h-3" /> Show less
              </>
            ) : (
              <>
                <ChevronRight className="w-3 h-3" /> Show all ({list.length})
              </>
            )}
          </button>
        )}
      </>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      {groups.named.map(({ key, cat, list }) => {
        const hex = categoryHex(cat?.color);
        return (
          <section key={key} className="flex flex-col gap-2">
            <div className="flex items-center gap-3 border-b px-1 pb-1" style={{ borderColor: `${hex}40` }}>
              <button
                onClick={() => onSelectCategory(key)}
                aria-label={`Open ${cat?.displayName ?? key} category`}
                className="flex items-center gap-2 group/hdr"
              >
                <span className="text-lg" aria-hidden="true">
                  {cat?.icon ?? "⚡"}
                </span>
                <h3 className="text-foreground text-sm font-mono font-bold tracking-widest uppercase group-hover/hdr:text-primary transition-colors">
                  {cat?.displayName ?? key}
                </h3>
              </button>
              <span
                className="text-xs font-mono font-bold px-1.5 py-0.5 rounded border flex-shrink-0"
                style={{ color: hex, borderColor: `${hex}50`, backgroundColor: `${hex}10` }}
              >
                {list.length}
              </span>
            </div>
            {renderList(key, list)}
          </section>
        );
      })}

      {groups.uncategorized.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-3 border-b border-border px-1 pb-1">
            <span className="text-lg" aria-hidden="true">📦</span>
            <h3 className="text-muted-foreground text-sm font-mono font-bold tracking-widest uppercase">
              Uncategorized
            </h3>
            <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded border border-border text-muted-foreground flex-shrink-0">
              {groups.uncategorized.length}
            </span>
            <span className="text-xs text-muted-foreground/60 ml-2">
              Drag onto a category to assign
            </span>
          </div>
          {renderList("", groups.uncategorized)}
        </section>
      )}
    </div>
  );
}
