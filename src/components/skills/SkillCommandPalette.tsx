import { useEffect, useMemo, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Star } from "lucide-react";
import { isDormant, skillInvocation, type SkillLike } from "@/lib/skills";

export type PaletteSkill = SkillLike & {
  displayName: string;
  description?: string | null;
  overrideDescription?: string | null;
  categoryName: string | null;
  categoryIcon: string;
  favorite: boolean;
};

interface SkillCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skills: PaletteSkill[];
  categories: { name: string; displayName: string }[];
}

/**
 * Ctrl+Shift+K fuzzy finder over every non-hidden skill. Enter copies the
 * invocation (D-02: copy stays, no launch is recorded and no Run item is
 * added here — the retired open-in-chat no-op was removed in Phase 99
 * Plan 06, D-13).
 * Composes Dialog + Command directly (not CommandDialog).
 */
export function SkillCommandPalette({
  open,
  onOpenChange,
  skills,
  categories,
}: SkillCommandPaletteProps) {
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && e.shiftKey && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) setFeedback(null);
  }, [open]);

  const visible = useMemo(() => skills.filter((s) => !s.hidden), [skills]);

  const groups = useMemo(() => {
    const favorites = visible.filter((s) => s.favorite);
    const catLabel = new Map(categories.map((c) => [c.name, c.displayName]));
    const byCat = new Map<string, PaletteSkill[]>();
    for (const s of visible.filter((s) => !s.favorite)) {
      const key = s.categoryName ?? "";
      const list = byCat.get(key);
      if (list) list.push(s);
      else byCat.set(key, [s]);
    }
    const named = [...byCat.entries()]
      .filter(([key]) => key !== "")
      .map(([key, list]) => ({ key, label: catLabel.get(key) ?? key, list }))
      .sort((a, b) => b.list.length - a.list.length);
    return { favorites, named, uncategorized: byCat.get("") ?? [] };
  }, [visible, categories]);

  const handleCopy = async (skill: PaletteSkill) => {
    const invocation = skillInvocation(skill);
    try {
      await navigator.clipboard.writeText(invocation);
      setFeedback(
        isDormant(skill)
          ? `${invocation} copied — dormant, not loaded`
          : `${invocation} copied`
      );
    } catch {
      setFeedback("copy failed");
    }
  };

  const renderItem = (skill: PaletteSkill) => {
    const invocation = skillInvocation(skill);
    const desc = skill.overrideDescription ?? skill.description ?? "";
    return (
      <CommandItem
        key={skill.name}
        value={skill.name}
        keywords={[skill.displayName, invocation, desc]}
        onSelect={() => void handleCopy(skill)}
        className={isDormant(skill) ? "opacity-50" : ""}
      >
        <span aria-hidden="true">{skill.categoryIcon}</span>
        <span className="font-mono text-primary">{invocation}</span>
        <span className="truncate text-muted-foreground">{skill.displayName}</span>
        {skill.favorite && (
          <Star aria-hidden="true" className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
        )}
        {isDormant(skill) && (
          <span className="ml-auto text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            dormant
          </span>
        )}
      </CommandItem>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">Skill palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search skills. Enter copies the invocation.
        </DialogDescription>
        <Command value={value} onValueChange={setValue}>
          <CommandInput placeholder="Search skills..." />
          <CommandList>
            <CommandEmpty>No skills found.</CommandEmpty>
            {groups.favorites.length > 0 && (
              <CommandGroup heading="Favorites">
                {groups.favorites.map(renderItem)}
              </CommandGroup>
            )}
            {groups.named.map((g) => (
              <CommandGroup key={g.key} heading={g.label}>
                {g.list.map(renderItem)}
              </CommandGroup>
            ))}
            {groups.uncategorized.length > 0 && (
              <CommandGroup heading="Uncategorized">
                {groups.uncategorized.map(renderItem)}
              </CommandGroup>
            )}
          </CommandList>
          <div
            aria-live="polite"
            className="border-t border-border px-3 py-2 text-[11px] font-mono text-muted-foreground"
          >
            {feedback ?? "↵ copy invocation"}
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
