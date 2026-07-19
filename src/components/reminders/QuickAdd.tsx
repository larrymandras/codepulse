/**
 * QuickAdd — always-visible reminder input bar (101-UI-SPEC.md "Quick-add
 * bar"). Defaults profile to the selected profile (caller passes profileId
 * through to the create mutation, not read here). Full NL date parsing is
 * out of scope — Ástríðr owns conversational NL (101-CONTEXT.md, deferred).
 *
 * Keyboard: "N" focuses the input (guarded against typing contexts).
 * DEVIATION from the literal 101-UI-SPEC.md "⌘K/N focus" wording:
 * DashboardLayout already owns Cmd/Ctrl+K globally for the CommandPalette
 * (src/layouts/DashboardLayout.tsx ~L553) — binding Cmd+K again here would
 * double-fire (open the palette AND focus this input in the same keystroke),
 * the exact collision documented in memory [[cmdk-and-global-hotkey-gotchas]].
 * "N" alone is unclaimed and used instead.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import type { ProfileId } from "@/pages/Reminders";
import type { RecurrenceFreq } from "../../../convex/reminders";

export interface NewReminderInput {
  title: string;
  dueAt?: number;
  priority: string;
  recurrence?: { freq: RecurrenceFreq; interval: number };
}

interface QuickAddProps {
  profileId: ProfileId;
  accentVar: string;
  onAdd: (input: NewReminderInput) => void | Promise<void>;
}

export function QuickAdd({ profileId, accentVar, onAdd }: QuickAddProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState("med");
  const [recurrence, setRecurrence] = useState<"none" | RecurrenceFreq>("none");

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  function reset() {
    setTitle("");
    setDueAt("");
    setPriority("med");
    setRecurrence("none");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    const input: NewReminderInput = {
      title: trimmed,
      priority,
      dueAt: dueAt ? Math.round(new Date(dueAt).getTime() / 1000) : undefined,
      recurrence: recurrence === "none" ? undefined : { freq: recurrence, interval: 1 },
    };
    reset();
    await onAdd(input);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-center gap-2 bg-card border border-border rounded-lg p-2 shrink-0"
      aria-label={`Add a reminder for ${profileId}`}
    >
      <Plus
        className="h-4 w-4 shrink-0"
        style={{ color: `var(${accentVar})` }}
        aria-hidden="true"
      />
      <Input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a reminder... (press N to focus)"
        aria-label="Reminder title"
        className="flex-1 min-w-[160px] border-0 shadow-none focus-visible:ring-0 bg-transparent"
      />
      <Input
        type="datetime-local"
        value={dueAt}
        onChange={(e) => setDueAt(e.target.value)}
        aria-label="Due date"
        className="w-auto text-sm"
      />
      <Select value={priority} onValueChange={setPriority}>
        <SelectTrigger size="sm" aria-label="Priority" className="w-[92px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="med">Med</SelectItem>
          <SelectItem value="high">High</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={recurrence}
        onValueChange={(v) => setRecurrence(v as "none" | RecurrenceFreq)}
      >
        <SelectTrigger size="sm" aria-label="Recurrence" className="w-[110px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">One-off</SelectItem>
          <SelectItem value="daily">Daily</SelectItem>
          <SelectItem value="weekly">Weekly</SelectItem>
          <SelectItem value="monthly">Monthly</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit" size="sm" disabled={!title.trim()}>
        Add
      </Button>
    </form>
  );
}
