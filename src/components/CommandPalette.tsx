import { useNavigate } from "react-router";
// Straight from cmdk: `useCommandState` is not re-exported by
// components/ui/command.tsx, and it is the only way to read the live search
// string from inside the <Command> subtree. See LinksGroup below for why the
// Links group needs it and no other group does.
import { useCommandState } from "cmdk";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { useCommandCatalog } from "@/hooks/useCommandCatalog";
import { useRecordLinkOpen } from "@/hooks/useBifrostLinks";
import { paletteLinks } from "@/lib/bifrostPaletteRank";
import type { PaletteLink } from "@/hooks/useCommandPaletteSearch";
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
  Link2,
} from "lucide-react";
// Leaf nav registry — NOT DashboardLayout, which imports CommandPalette
// (importing it here created an import cycle; WR-02, phase 96 review).
import { navItems, iconComponents } from "@/lib/navRegistry";

// Voice moved to the Ástríðr presence page (/chat, 2026-07-20) — the palette
// is text-only again.
interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The Bifröst Links group.
 *
 * Split into its own component for one reason: `useCommandState` only works
 * inside the <Command> subtree, and this group — alone among the palette's
 * groups — needs the live search string to decide whether its cap applies.
 *
 * Every other group slices to 20 in `useCommandPaletteSearch` and is content to
 * do so, because those are telemetry sets where the tail is genuinely noise. A
 * link is different: the whole point of putting a URL in the hub is to be able
 * to find it again, so a fixed slice would make everything past the top 20
 * permanently unsearchable. Instead the cap holds while the query is empty (the
 * resting palette, where an unbounded dump is the problem) and lifts the moment
 * the operator types (where the query is already doing the narrowing).
 *
 * The heading states the bound out loud rather than truncating silently — a
 * capped list that looks complete is how you conclude a link was never saved.
 */
function LinksGroup({
  links,
  onOpen,
}: {
  links: PaletteLink[];
  onOpen: (link: PaletteLink) => void;
}) {
  const search = useCommandState((state) => state.search);
  const hasQuery = (search ?? "").trim() !== "";
  const visible = paletteLinks(links, hasQuery);

  if (visible.length === 0) return null;

  const hidden = links.length - visible.length;
  const heading =
    hidden > 0
      ? `Links · ${visible.length} most used of ${links.length} — type to search all`
      : "Links";

  return (
    <CommandGroup heading={heading}>
      {visible.map((l) => {
        const Icon = (l.icon && iconComponents[l.icon]) || Link2;
        return (
          <CommandItem
            key={l.id}
            // The explicit `value` is load-bearing, not decoration. cmdk keys
            // selection by value and derives it from item TEXT when none is
            // given, so a link titled "Forge" would collide with the Forge nav
            // entry in the Pages group — producing the double-highlight and
            // ArrowDown loop this repo has hit before. Including the URL makes
            // each value unique while keeping both title and URL searchable.
            value={`${l.title} ${l.url}`}
            onSelect={() => onOpen(l)}
          >
            <Icon className="mr-2 h-4 w-4" />
            {l.title}
          </CommandItem>
        );
      })}
    </CommandGroup>
  );
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { sendCommand } = useAstridrWS();
  const { agents, sessions, alerts, cronJobs, links } =
    useCommandPaletteSearch();
  const { commands, status: commandsStatus } = useCommandCatalog();

  const recordLinkOpen = useRecordLinkOpen();

  function select(action: () => void) {
    action();
    onOpenChange(false);
  }

  /**
   * Opening a link is the ONLY thing that counts as usage — this is the write
   * that teaches the palette what to surface. Deliberately fire-and-forget and
   * ordered BEFORE the navigation: `window.open` can hand the tab focus away
   * mid-callback, and a count is never worth delaying or blocking a launch.
   *
   * Failure handling lives in `useRecordLinkOpen`, not here — a rejection is
   * logged and announced once rather than discarded, so a persistently broken
   * write cannot masquerade as "these links are never opened".
   */
  function openLink(l: PaletteLink) {
    recordLinkOpen(l.id);
    select(() => {
      if (/^https?:\/\//i.test(l.url)) {
        window.open(l.url, "_blank", "noopener,noreferrer");
      } else {
        navigate(l.url);
      }
    });
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
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
              <CommandItem
                key={to}
                // Phase 124 D-05: measured live (124-04-SUMMARY.md) that two
                // Pages entries sharing a label ("Analytics", pre-rename)
                // collided on cmdk's derived-from-text fallback — both
                // resolved to the identical cmdk selection key. The rename to
                // "Agent Analytics" already resolves THIS instance, but an
                // explicit value prop guards against any future duplicate
                // label, matching the Links group's defence at :87-89.
                value={`${item.label} ${to}`}
                onSelect={() => select(() => navigate(to))}
              >
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        {/* Phase 117 D-05: Bifröst links. Enter opens the URL — external ones in
            a new tab, internal paths through the router. Ranking, bounding and
            the cmdk value-collision guard all live in LinksGroup above. */}
        <LinksGroup links={links} onOpen={openLink} />

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
    </CommandDialog>
  );
}
