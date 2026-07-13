import { useNavigate } from "react-router-dom";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { useCommandCatalog } from "@/hooks/useCommandCatalog";
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
import { VoiceModePanel } from "@/components/voice/VoiceModePanel";
import type { VoiceState } from "@/components/voice/voiceState";
import {
  Bot,
  Clock,
  Bell,
  Timer,
  Send,
  Inbox,
  BellOff,
  MessageSquare,
  Terminal,
  Navigation,
  Zap,
  LayoutDashboard,
} from "lucide-react";
// Leaf nav registry — NOT DashboardLayout, which imports CommandPalette
// (importing it here created an import cycle; WR-02, phase 96 review).
import { navItems, iconComponents } from "@/lib/navRegistry";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, renders VoiceModePanel instead of the text search UI. */
  voiceMode?: boolean;
  /** Voice state passed through to VoiceModePanel. Defaults to 'listening'. */
  voiceState?: VoiceState;
  /** Called when VoiceModePanel requests close (end-phrase / X / silence). */
  onVoiceClose?: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  voiceMode = false,
  voiceState,
  onVoiceClose,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const { sendCommand } = useAstridrWS();
  const { agents, sessions, alerts, cronJobs } = useCommandPaletteSearch();
  const { commands, status: commandsStatus } = useCommandCatalog();

  function select(action: () => void) {
    action();
    onOpenChange(false);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      {voiceMode ? (
        <VoiceModePanel
          voiceState={voiceState ?? "listening"}
          onClose={() => {
            onVoiceClose?.();
            onOpenChange(false);
          }}
        />
      ) : (
      <>
      <CommandInput placeholder="Search pages, agents, sessions, commands..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Pages group — all navigation routes, sourced from the single navItems registry (F2) */}
        <CommandGroup heading="Pages">
          {navItems.map((item) => {
            if (!item.to) return null;
            const to = item.to;
            const Icon = iconComponents[item.icon] ?? LayoutDashboard;
            return (
              <CommandItem key={to} onSelect={() => select(() => navigate(to))}>
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Agents">
          {agents.map((a) => (
            <CommandItem key={a.id} onSelect={() => select(() => navigate("/hr/roster"))}>
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

        <CommandSeparator />

        {/* Actions group — privileged system operations */}
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() =>
              select(() => {
                void sendCommand({ type: "agent.emergency_stop" });
                toast.warning("Emergency stop sent");
              })
            }
          >
            <Zap className="mr-2 h-4 w-4" />
            Emergency Stop
          </CommandItem>
          <CommandItem
            onSelect={() =>
              select(() => {
                void sendCommand({ type: "config.reload" });
                toast.success("Config reload requested");
              })
            }
          >
            <Zap className="mr-2 h-4 w-4" />
            Config Reload
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Commands group — live Ástríðr command registry from WebSocket */}
        <CommandGroup heading="Commands">
          {commandsStatus === "ready" && commands.length > 0 ? (
            commands.slice(0, 10).map((cmd) => (
              <CommandItem
                key={cmd.name}
                onSelect={() =>
                  select(() =>
                    navigate(`/capabilities?try=${encodeURIComponent(cmd.name)}`)
                  )
                }
              >
                <Terminal className="mr-2 h-4 w-4" />
                {cmd.name}
                <span className="ml-auto text-sm text-muted-foreground">
                  {cmd.category}
                </span>
              </CommandItem>
            ))
          ) : (
            <CommandItem disabled>
              <Navigation className="mr-2 h-4 w-4 opacity-40" />
              {commandsStatus === "ready"
                ? "No commands registered"
                : "Loading command registry..."}
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
      </>
      )}
    </CommandDialog>
  );
}
