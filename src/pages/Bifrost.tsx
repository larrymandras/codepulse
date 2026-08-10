/**
 * Bifröst — the link hub (Phase 117).
 *
 * A categorised grid of the URLs Larry actually opens, with a pinned row on top
 * and a liveness dot for links backed by a container.
 *
 * D-02, and the reason this looks different from the design doc: liveness joins
 * on CONTAINER NAME, not host:port. The doc specified reusing "the
 * Infrastructure page's existing probe data (join on host:port)" — no port or
 * host field exists anywhere in the schema, so that join has nothing to join on.
 * `docker:currentStatus` does carry live per-container status, and
 * `DockerPanel.tsx:70` already renders it as exactly this dot.
 *
 * D-03: a link with no `containerName` renders NO dot — never a green one. An
 * absent signal must not read as "up".
 *
 * D-06, so the absences read as decisions: drag-reorder within a category is
 * deferred (the `order` field ships and is respected; the drag UI does not), as
 * are the `/bifrost-scan` and `/link-add` curation skills.
 */
import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { ExternalLink, Link2, Pin, PinOff, Trash2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { PageHeader } from "@/components/PageHeader";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { iconComponents } from "@/lib/navRegistry";
import {
  useBifrostLinksState,
  useContainerStatusMap,
} from "@/hooks/useBifrostLinks";

interface LinkRow {
  _id: string;
  title: string;
  url: string;
  description?: string;
  category: string;
  icon?: string;
  pinned?: boolean;
  order?: number;
  isLocalService?: boolean;
  containerName?: string;
  createdAt: number;
}

/**
 * D-03 in one function. `null` means "no signal" and MUST render as no dot;
 * only a real container status produces a colour.
 */
export function livenessOf(
  link: { containerName?: string },
  statuses: Record<string, string>
): "up" | "down" | null {
  if (!link.containerName) return null;
  const status = statuses[link.containerName];
  if (status === undefined) return null;
  return status === "running" ? "up" : "down";
}

function LivenessDot({ state }: { state: "up" | "down" | null }) {
  if (state === null) return null;
  return (
    <span
      data-testid={`bifrost-dot-${state}`}
      aria-label={state === "up" ? "Service running" : "Service not running"}
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{
        backgroundColor:
          state === "up" ? "var(--status-ok)" : "var(--status-error)",
      }}
    />
  );
}

function LinkCard({
  link,
  liveness,
  onTogglePin,
  onArchive,
}: {
  link: LinkRow;
  liveness: "up" | "down" | null;
  onTogglePin: () => void;
  onArchive: () => void;
}) {
  const Icon = (link.icon && iconComponents[link.icon]) || Link2;
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle className="flex min-w-0 items-center gap-2 text-sm">
          <Icon className="h-4 w-4 shrink-0" />
          <LivenessDot state={liveness} />
          <span className="truncate">{link.title}</span>
        </CardTitle>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`${link.pinned ? "Unpin" : "Pin"} ${link.title}`}
            onClick={onTogglePin}
          >
            {link.pinned ? (
              <PinOff className="text-muted-foreground h-4 w-4" />
            ) : (
              <Pin className="text-muted-foreground h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            aria-label={`Archive ${link.title}`}
            onClick={onArchive}
          >
            <Trash2 className="text-muted-foreground h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {link.description && (
          <p className="text-muted-foreground line-clamp-2 text-xs">
            {link.description}
          </p>
        )}
        <a
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="text-primary inline-flex items-center gap-1 font-mono text-xs break-all"
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          {link.url}
        </a>
      </CardContent>
    </Card>
  );
}

function QuickAddDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (input: {
    title: string;
    url: string;
    category: string;
    containerName?: string;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("");
  const [containerName, setContainerName] = useState("");

  const canSave = title.trim() !== "" && url.trim() !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Add link</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="bifrost-title">Title</Label>
            <Input
              id="bifrost-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bifrost-url">URL</Label>
            <Input
              id="bifrost-url"
              value={url}
              className="font-mono"
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bifrost-category">Category</Label>
            <Input
              id="bifrost-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bifrost-container">Container name</Label>
            <Input
              id="bifrost-container"
              value={containerName}
              className="font-mono"
              onChange={(e) => setContainerName(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Optional. Matches a Docker container name to show a liveness dot.
              Leave blank and the link shows no dot rather than a green one.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!canSave}
            onClick={() => {
              onCreate({
                title: title.trim(),
                url: url.trim(),
                category: category.trim() || "uncategorized",
                containerName: containerName.trim() || undefined,
              });
              setTitle("");
              setUrl("");
              setCategory("");
              setContainerName("");
              onOpenChange(false);
            }}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BifrostBody({ search }: { search: string }) {
  const { links, isLoading } = useBifrostLinksState();
  const statuses = useContainerStatusMap();
  const togglePin = useMutation(api.bifrost.togglePin);
  const archiveLink = useMutation(api.bifrost.archiveLink);

  const rows = links as unknown as LinkRow[];

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q) ||
        (l.description ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const pinned = visible.filter((l) => l.pinned);
  const byCategory = useMemo(() => {
    const groups = new Map<string, LinkRow[]>();
    for (const l of visible.filter((x) => !x.pinned)) {
      const list = groups.get(l.category) ?? [];
      list.push(l);
      groups.set(l.category, list);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [visible]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-4">
            <Skeleton className="mb-3 h-5 w-2/3" />
            <Skeleton className="h-3 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="border-primary/20 bg-primary/5 rounded border border-dashed p-10 text-center">
        <p className="text-foreground mb-1 text-lg font-bold">No links yet</p>
        <p className="text-muted-foreground text-sm">
          Add the URLs you open every day — dashboards, local services, repos.
        </p>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="text-muted-foreground border-primary/20 bg-primary/5 rounded border border-dashed py-8 text-center font-mono text-sm tracking-widest">
        [ NO LINKS MATCH ]
      </div>
    );
  }

  const grid = (list: LinkRow[]) => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {list.map((link) => (
        <LinkCard
          key={link._id}
          link={link}
          liveness={livenessOf(link, statuses)}
          onTogglePin={() => void togglePin({ linkId: link._id as never })}
          onArchive={() => void archiveLink({ linkId: link._id as never })}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {pinned.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-muted-foreground font-mono text-xs font-bold tracking-widest uppercase">
            Pinned
          </h2>
          {grid(pinned)}
        </section>
      )}
      {byCategory.map(([category, list]) => (
        <section key={category} className="space-y-2">
          <h2 className="text-muted-foreground font-mono text-xs font-bold tracking-widest uppercase">
            {category}
          </h2>
          {grid(list)}
        </section>
      ))}
    </div>
  );
}

export default function Bifrost() {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const createLink = useMutation(api.bifrost.createLink);

  return (
    <div className="p-6">
      <PageHeader
        title="Bifröst"
        icon={Link2}
        actions={
          <div className="flex items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search links..."
              className="w-64"
              aria-label="Search links"
            />
            <Button onClick={() => setAddOpen(true)}>Add link</Button>
          </div>
        }
      />

      <SectionErrorBoundary name="Links">
        <BifrostBody search={search} />
      </SectionErrorBoundary>

      <QuickAddDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreate={(input) => void createLink(input)}
      />
    </div>
  );
}
