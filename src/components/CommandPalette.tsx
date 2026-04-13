import { useNavigate } from "react-router-dom";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { useCommandPaletteSearch } from "@/hooks/useCommandPaletteSearch";
import { Bot, Clock, Bell, Timer, Send, Inbox, BellOff, MessageSquare } from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { sendCommand } = useAstridrWS();
  const { agents, sessions, alerts, cronJobs } = useCommandPaletteSearch();

  function select(action: () => void) {
    action();
    onOpenChange(false);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search agents, sessions, alerts, cron jobs..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Agents">
          {agents.map((a) => (
            <CommandItem key={a.id} onSelect={() => select(() => navigate("/agents"))}>
              <Bot className="mr-2 h-4 w-4" />
              {a.name}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Sessions">
          {sessions.map((s) => (
            <CommandItem key={s.id} onSelect={() => select(() => navigate(`/executions`))}>
              <Clock className="mr-2 h-4 w-4" />
              {s.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Alerts">
          {alerts.map((a) => (
            <CommandItem key={a.id} onSelect={() => select(() => navigate("/alerts"))}>
              <Bell className="mr-2 h-4 w-4" />
              {a.title}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* D-01/D-03: Cron Jobs is an explicit entity group in the palette */}
        <CommandGroup heading="Cron Jobs">
          {cronJobs.map((c) => (
            <CommandItem key={c.id} onSelect={() => select(() => navigate("/automation"))}>
              <Timer className="mr-2 h-4 w-4" />
              {c.name}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => select(() => navigate("/chat"))}>
            <Send className="mr-2 h-4 w-4" />
            Send task to agent
          </CommandItem>
          <CommandItem onSelect={() => select(() => navigate("/inbox"))}>
            <Inbox className="mr-2 h-4 w-4" />
            View Unified Inbox
          </CommandItem>
          <CommandItem
            onSelect={() =>
              select(() => {
                void sendCommand({ type: "alerts.mute_all" });
                toast.success("All alerts muted");
              })
            }
          >
            <BellOff className="mr-2 h-4 w-4" />
            Mute all alerts
          </CommandItem>
          <CommandItem onSelect={() => select(() => navigate("/chat"))}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Navigate to Insights Chat
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
