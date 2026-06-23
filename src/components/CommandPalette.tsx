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
  Cpu,
  BarChart2,
  Server,
  Users,
  Shield,
  Lightbulb,
  RefreshCw,
  Hammer,
  Brain,
  Moon,
  ScrollText,
  List,
  Settings,
  TrendingUp,
  Activity,
  KanbanSquare,
  SlidersHorizontal,
  Radio,
  Video,
  LayoutGrid,
} from "lucide-react";

// Nav items shared with DashboardLayout — kept in sync manually
const NAV_PAGES = [
  { to: "/", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/capabilities", label: "Capabilities", Icon: Cpu },
  { to: "/analytics", label: "Analytics", Icon: BarChart2 },
  { to: "/alerts", label: "Alerts", Icon: Bell },
  { to: "/infrastructure", label: "Infrastructure", Icon: Server },
  { to: "/agents", label: "Agents", Icon: Bot },
  { to: "/profiles", label: "Profiles", Icon: Users },
  { to: "/security", label: "Security", Icon: Shield },
  { to: "/ideation", label: "Ideation", Icon: Lightbulb },
  { to: "/self-healing", label: "Self-Healing", Icon: RefreshCw },
  { to: "/build", label: "Build", Icon: Hammer },
  { to: "/memory", label: "Memory", Icon: Brain },
  { to: "/dreaming", label: "Dreaming", Icon: Moon },
  { to: "/briefings", label: "Briefings", Icon: ScrollText },
  { to: "/automation", label: "Automation", Icon: Clock },
  { to: "/executions", label: "Executions", Icon: List },
  { to: "/settings", label: "Settings", Icon: Settings },
  { to: "/insights", label: "Insights", Icon: TrendingUp },
  { to: "/chat", label: "Chat", Icon: MessageSquare },
  { to: "/live-run", label: "Live Run", Icon: Activity },
  { to: "/inbox", label: "Inbox", Icon: Inbox },
  { to: "/tasks", label: "Tasks", Icon: KanbanSquare },
  { to: "/config", label: "Config", Icon: SlidersHorizontal },
  { to: "/war-room", label: "War Room", Icon: Radio },
  { to: "/meeting-bot", label: "Meeting Bot", Icon: Video },
  { to: "/mission-control", label: "Mission Control", Icon: LayoutGrid },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
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
      <CommandInput placeholder="Search pages, agents, sessions, commands..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Pages group — all navigation routes */}
        <CommandGroup heading="Pages">
          {NAV_PAGES.map(({ to, label, Icon }) => (
            <CommandItem key={to} onSelect={() => select(() => navigate(to))}>
              <Icon className="mr-2 h-4 w-4" />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

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
    </CommandDialog>
  );
}
