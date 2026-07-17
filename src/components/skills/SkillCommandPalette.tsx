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
  onRecordUse: (skillName: string) => void;
  onOpenInChat: (skillName: string) => void;
}

/**
 * Ctrl+Shift+K fuzzy finder over every non-hidden skill. Enter copies the
 * invocation (primary action, recorded); Ctrl+Enter opens the skill in Chat.
 * Composes Dialog + Command directly (not CommandDialog) because Ctrl+Enter
 * needs cmdk's controlled `value` to know the highlighted item.
 */
export function SkillCommandPalette({
  open,
  onOpenChange,
  skills,
  categories,
  onRecordUse,
  onOpenInChat,
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
    onRecordUse(skill.name);
  };

  const handleOpenChat = (skill: PaletteSkill) => {
    onOpenInChat(skill.name);
    onOpenChange(false);
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
          Search skills. Enter copies the invocation; Ctrl+Enter opens in Chat.
        </DialogDescription>
        <Command
          value={value}
          onValueChange={setValue}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              const skill = visible.find((s) => s.name === value);
              if (skill) handleOpenChat(skill);
            }
          }}
        >
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
            {feedback ?? "↵ copy invocation · ctrl+↵ open in Chat"}
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
