/**
 * StudioFilterBar — chips + Selects + search, per 118-UI-SPEC.md § "Filter
 * Contract" (Phase 118, plan 118-10 Task 3).
 *
 * Two tiers, mirroring "Galdr's chip row, but bounded": chips for the small
 * closed sets (`mediaType`, `starred`, provenance), `Select` dropdowns for
 * the open-ended sets that grow without bound as more models/projects are
 * used — a chip row for `model` would grow unreadable the way Galdr's
 * `category` chips do not, because categories stay small by convention
 * while `model` slugs will not.
 *
 * Filtering happens entirely client-side over the already-subscribed
 * `api.media.list` rows — no filter is ever pushed into the Convex query,
 * matching how Galdr/Bifröst treat their own sets (`convex/media.ts`'s own
 * docstring states the same UX decision from the read side).
 */
import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MediaRow } from "./MediaCard";

export type StudioChip =
  | "all"
  | "image"
  | "video"
  | "audio"
  | "starred"
  | "missing-provenance";

export interface StudioFilterState {
  chip: StudioChip;
  kind: "any" | "gen" | "ref" | "style";
  model: string; // "any" or a distinct value present in the loaded rows
  project: string; // "any" or a distinct value present in the loaded rows
}

export const DEFAULT_STUDIO_FILTERS: StudioFilterState = {
  chip: "all",
  kind: "any",
  model: "any",
  project: "any",
};

/** Same `matchesSearch` shape as `Galdr.tsx:96-105` — filename/prompt/model/
 * project, case-insensitive substring. */
export function matchesStudioSearch(row: MediaRow, needle: string): boolean {
  if (!needle) return true;
  const q = needle.toLowerCase();
  return (
    row.filename.toLowerCase().includes(q) ||
    (row.prompt ?? "").toLowerCase().includes(q) ||
    (row.model ?? "").toLowerCase().includes(q) ||
    (row.project ?? "").toLowerCase().includes(q)
  );
}

function matchesChip(row: MediaRow, chip: StudioChip): boolean {
  switch (chip) {
    case "all":
      return true;
    case "image":
    case "video":
    case "audio":
      return row.mediaType === chip;
    case "starred":
      return Boolean(row.starred);
    case "missing-provenance":
      return !row.hasProvenance;
  }
}

function matchesSelects(row: MediaRow, filters: StudioFilterState): boolean {
  return (
    (filters.kind === "any" || row.kind === filters.kind) &&
    (filters.model === "any" || row.model === filters.model) &&
    (filters.project === "any" || row.project === filters.project)
  );
}

/**
 * The single filter/sort pipeline `Studio.tsx`'s Gallery tab renders from.
 * Default sort is `createdAt` desc — no favorites-float-up, unlike Galdr:
 * a visual gallery's recency is the primary signal, and starred items are
 * reachable via the `Starred` chip instead of a silent reorder.
 */
export function applyStudioFilters(
  rows: MediaRow[],
  filters: StudioFilterState,
  search: string
): MediaRow[] {
  const filtered = rows.filter(
    (r) =>
      matchesStudioSearch(r, search) &&
      matchesChip(r, filters.chip) &&
      matchesSelects(r, filters)
  );
  return [...filtered].sort((a, b) => b.createdAt - a.createdAt);
}

function distinctSorted(rows: MediaRow[], field: "model" | "project"): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    const v = row[field];
    if (v) values.add(v);
  }
  return [...values].sort((a, b) => a.localeCompare(b));
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
  // Visual treatment mirrors Galdr.tsx:143-172's FilterChip verbatim (same
  // active/inactive classes, same aria-pressed, same count span).
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

export function StudioFilterBar({
  rows,
  search,
  filters,
  onFiltersChange,
}: {
  /** The full, unfiltered Gallery rows currently loaded. */
  rows: MediaRow[];
  search: string;
  filters: StudioFilterState;
  onFiltersChange: (next: StudioFilterState) => void;
}) {
  const searched = useMemo(
    () => rows.filter((r) => matchesStudioSearch(r, search)),
    [rows, search]
  );
  const selectFiltered = useMemo(
    () => searched.filter((r) => matchesSelects(r, filters)),
    [searched, filters]
  );

  const chipCount = (chip: StudioChip) =>
    selectFiltered.filter((r) => matchesChip(r, chip)).length;

  const models = useMemo(() => distinctSorted(searched, "model"), [searched]);
  const projects = useMemo(() => distinctSorted(searched, "project"), [searched]);

  const setChip = (chip: StudioChip) => onFiltersChange({ ...filters, chip });

  return (
    <div className="space-y-3">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filter media"
      >
        <FilterChip
          label="All"
          count={chipCount("all")}
          active={filters.chip === "all"}
          onClick={() => setChip("all")}
          testId="studio-chip-all"
        />
        <FilterChip
          label="Image"
          count={chipCount("image")}
          active={filters.chip === "image"}
          onClick={() => setChip("image")}
          testId="studio-chip-image"
        />
        <FilterChip
          label="Video"
          count={chipCount("video")}
          active={filters.chip === "video"}
          onClick={() => setChip("video")}
          testId="studio-chip-video"
        />
        <FilterChip
          label="Audio"
          count={chipCount("audio")}
          active={filters.chip === "audio"}
          onClick={() => setChip("audio")}
          testId="studio-chip-audio"
        />
        <FilterChip
          label="Starred"
          count={chipCount("starred")}
          active={filters.chip === "starred"}
          onClick={() => setChip("starred")}
          testId="studio-chip-starred"
        />
        <FilterChip
          label="Missing Provenance"
          count={chipCount("missing-provenance")}
          active={filters.chip === "missing-provenance"}
          onClick={() => setChip("missing-provenance")}
          testId="studio-chip-missing-provenance"
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="studio-filter-kind" className="text-muted-foreground text-xs">
            Kind
          </Label>
          <Select
            value={filters.kind}
            onValueChange={(v) =>
              onFiltersChange({ ...filters, kind: v as StudioFilterState["kind"] })
            }
          >
            <SelectTrigger
              id="studio-filter-kind"
              size="sm"
              data-testid="studio-select-kind"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="gen">Gen</SelectItem>
              <SelectItem value="ref">Ref</SelectItem>
              <SelectItem value="style">Style</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          <Label htmlFor="studio-filter-model" className="text-muted-foreground text-xs">
            Model
          </Label>
          <Select
            value={filters.model}
            onValueChange={(v) => onFiltersChange({ ...filters, model: v })}
          >
            <SelectTrigger
              id="studio-filter-model"
              size="sm"
              data-testid="studio-select-model"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              {models.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          <Label htmlFor="studio-filter-project" className="text-muted-foreground text-xs">
            Project
          </Label>
          <Select
            value={filters.project}
            onValueChange={(v) => onFiltersChange({ ...filters, project: v })}
          >
            <SelectTrigger
              id="studio-filter-project"
              size="sm"
              data-testid="studio-select-project"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
