/**
 * Galdr — the prompt library page (Phase 116, plan 116-08).
 *
 * Assembles the components from plan 116-06 over the live `api.galdr.*` surface.
 * Every delivery path on this page routes through `SendSplitButton`, which routes
 * through `FillVariablesDialog` — so nothing here can hand `/chat` an unresolved
 * body (D-11/D-12).
 *
 * Scope boundaries that are decisions, not omissions:
 *  - No archived-prompts view, and no control to bring one back. D-16 retains an
 *    archived prompt and its versions but does not make it reachable again from
 *    the UI this phase.
 *  - No purge or hard delete anywhere. Plan 116-03 exposes no mutation that could
 *    serve one, so there is nothing to wire even if a control existed.
 *  - No seed rows. The library begins genuinely empty and the empty state is the
 *    first-run experience.
 *  - No category-admin UI. `category` is a plain string field (plan 116-01), so
 *    the chips are derived from the live rows at render time.
 */
import { Component, useMemo, useState, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { MoreHorizontal, Pencil, Sparkles, Star } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { PageHeader } from "@/components/PageHeader";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SendSplitButton } from "@/components/galdr/SendSplitButton";
import {
  PromptEditorDrawer,
  type EditablePrompt,
} from "@/components/galdr/PromptEditorDrawer";
import {
  useGaldrPromptsState,
  useGaldrPromptVersions,
} from "@/hooks/useGaldrPrompts";

const ERROR_COPY =
  "Couldn't load prompts — check your connection and try again.";

interface PromptRow {
  _id: string;
  title: string;
  slug: string;
  body: string;
  category: string;
  favorite?: boolean;
  usageCount: number;
  lastUsedAt?: number;
  updatedAt: number;
  variables: string[];
}

/**
 * Renders the UI-SPEC error copy instead of the generic boundary text. A Convex
 * `useQuery` that throws does so during render, which unmounts the whole subtree
 * — so the only way to keep the failure scoped to this region is a boundary
 * around the component that calls the hook.
 */
class PromptsErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-muted-foreground border-border rounded-md border p-8 text-center text-sm">
          {ERROR_COPY}
        </div>
      );
    }
    return this.props.children;
  }
}

type ChipId = string;

function matchesSearch(prompt: PromptRow, needle: string): boolean {
  if (!needle) return true;
  const q = needle.toLowerCase();
  return (
    prompt.title.toLowerCase().includes(q) ||
    prompt.slug.toLowerCase().includes(q) ||
    prompt.category.toLowerCase().includes(q) ||
    prompt.body.toLowerCase().includes(q)
  );
}

/** Favorites first, then most-used, then most-recently-updated. */
function defaultSort(a: PromptRow, b: PromptRow): number {
  if (Boolean(b.favorite) !== Boolean(a.favorite)) {
    return Number(Boolean(b.favorite)) - Number(Boolean(a.favorite));
  }
  if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
  return b.updatedAt - a.updatedAt;
}

export function applyChipAndSearch(
  prompts: PromptRow[],
  chip: ChipId,
  search: string
): PromptRow[] {
  const searched = prompts.filter((p) => matchesSearch(p, search));

  if (chip === "recent") {
    // Exactly the prompts that have ever been delivered, newest first. No time
    // window and no cap. A never-used prompt has no `lastUsedAt` at all, so it is
    // ABSENT here rather than sorted to the end. This chip overrides the default
    // sort; every other chip keeps it.
    return searched
      .filter((p) => p.lastUsedAt !== undefined && p.lastUsedAt !== null)
      .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0));
  }

  const filtered =
    chip === "all"
      ? searched
      : chip === "favorites"
        ? searched.filter((p) => p.favorite)
        : searched.filter((p) => p.category === chip);

  return [...filtered].sort(defaultSort);
}

function FilterChip({
  label,
  count,
  active,
  onClick,
  testId,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-xs font-bold transition-all ${
        active
          ? "border-primary bg-primary/15 text-primary shadow-[var(--glow-xs)]"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
    >
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}

function PromptCard({
  prompt,
  onEdit,
  onToggleFavorite,
  onUsage,
}: {
  prompt: PromptRow;
  onEdit: () => void;
  onToggleFavorite: () => void;
  onUsage: (slug: string) => void;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle className="cursor-pointer text-sm" onClick={onEdit}>
          {prompt.title}
        </CardTitle>
        <button
          type="button"
          aria-label={`Toggle favorite ${prompt.title}`}
          onClick={onToggleFavorite}
        >
          {/* var(--status-warn), deliberately NOT SkillRow.tsx's hardcoded
              Tailwind amber literal — that contradicts the repo's own
              no-hardcoded-colour rule. Do not "correct" this back. */}
          <Star
            className="h-4 w-4"
            style={
              prompt.favorite
                ? { fill: "var(--status-warn)", color: "var(--status-warn)" }
                : undefined
            }
          />
        </button>
      </CardHeader>

      <CardContent className="flex-1 cursor-pointer space-y-2" onClick={onEdit}>
        {/* Plain text. The body is agent-authored free text; rendering it as
            HTML would be a stored-XSS surface for zero benefit (T-116-09). */}
        <p className="text-muted-foreground line-clamp-2 font-mono text-xs">
          {prompt.body}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground border-border rounded-full border px-2 py-0.5 font-mono text-xs">
            {prompt.category}
          </span>
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {prompt.usageCount}×
          </span>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-2">
        <SendSplitButton prompt={prompt} onUsage={onUsage} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`More actions for ${prompt.title}`}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onEdit();
              }}
            >
              <Pencil />
              Edit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  );
}

function GaldrLibrary({
  search,
  onEdit,
}: {
  search: string;
  onEdit: (prompt: PromptRow) => void;
}) {
  const { prompts, isLoading } = useGaldrPromptsState();
  const [chip, setChip] = useState<ChipId>("all");

  const rows = prompts as unknown as PromptRow[];

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of rows) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const visible = useMemo(
    () => applyChipAndSearch(rows, chip, search),
    [rows, chip, search]
  );

  const toggleFavorite = useMutation(api.galdr.toggleFavorite);
  const recordUsage = useMutation(api.galdr.recordUsage);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-4">
            <Skeleton className="mb-3 h-5 w-2/3" />
            <Skeleton className="mb-2 h-3 w-full" />
            <Skeleton className="mb-3 h-3 w-4/5" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </Card>
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="border-primary/20 bg-primary/5 rounded border border-dashed p-10 text-center">
        <p className="text-foreground mb-1 text-lg font-bold">No prompts yet</p>
        <p className="text-muted-foreground text-sm">
          Save one from Claude Code with /galdr-save &lt;title&gt;, or create one
          here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter prompts">
        <FilterChip
          label="All"
          count={rows.length}
          active={chip === "all"}
          onClick={() => setChip("all")}
          testId="galdr-chip-all"
        />
        <FilterChip
          label="Favorites"
          count={rows.filter((p) => p.favorite).length}
          active={chip === "favorites"}
          onClick={() => setChip("favorites")}
          testId="galdr-chip-favorites"
        />
        <FilterChip
          label="Recently used"
          count={rows.filter((p) => p.lastUsedAt !== undefined).length}
          active={chip === "recent"}
          onClick={() => setChip("recent")}
          testId="galdr-chip-recent"
        />
        {categories.map(([name, count]) => (
          <FilterChip
            key={name}
            label={name}
            count={count}
            active={chip === name}
            onClick={() => setChip(name)}
            testId={`galdr-chip-${name}`}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="text-muted-foreground border-primary/20 bg-primary/5 rounded border border-dashed py-8 text-center font-mono text-sm tracking-widest">
          [ NO PROMPTS MATCH ]
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((prompt) => (
            <PromptCard
              key={prompt._id}
              prompt={prompt}
              onEdit={() => onEdit(prompt)}
              onToggleFavorite={() =>
                void toggleFavorite({ promptId: prompt._id as never })
              }
              onUsage={(slug) => void recordUsage({ slug })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Galdr() {
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<EditablePrompt | null>(null);

  const versions = useGaldrPromptVersions(drawerOpen ? editing?._id : null);

  const createPrompt = useMutation(api.galdr.createPrompt);
  const updatePrompt = useMutation(api.galdr.updatePrompt);
  const restoreVersion = useMutation(api.galdr.restoreVersion);
  const archivePrompt = useMutation(api.galdr.archivePrompt);

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Galdr"
        icon={Sparkles}
        actions={
          <div className="flex items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search prompts..."
              className="w-64"
              aria-label="Search prompts"
            />
            <Button onClick={openCreate}>New Prompt</Button>
          </div>
        }
      />

      <SectionErrorBoundary name="Prompts">
        <PromptsErrorBoundary>
          <GaldrLibrary
            search={search}
            onEdit={(prompt) => {
              setEditing({
                _id: prompt._id,
                title: prompt.title,
                slug: prompt.slug,
                body: prompt.body,
                category: prompt.category,
              });
              setDrawerOpen(true);
            }}
          />
        </PromptsErrorBoundary>
      </SectionErrorBoundary>

      <PromptEditorDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        prompt={editing}
        versions={versions as never}
        // Each awaited rather than returned directly: these mutations resolve to
        // an Id or null, and the drawer's callbacks are typed Promise<void>.
        // `await` also keeps a SLUG_COLLISION ConvexError propagating into the
        // drawer's own catch, which is what renders the D-06 inline message.
        onCreate={async (input) => {
          await createPrompt(input as never);
        }}
        onUpdate={async ({ promptId, ...rest }) => {
          await updatePrompt({ promptId: promptId as never, ...rest });
        }}
        onRestore={async ({ promptId, versionId }) => {
          await restoreVersion({
            promptId: promptId as never,
            versionId: versionId as never,
          });
        }}
        onArchive={async ({ promptId }) => {
          await archivePrompt({ promptId: promptId as never });
        }}
      />
    </div>
  );
}
