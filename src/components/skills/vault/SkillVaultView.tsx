import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Boxes, Search, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveThemeColors } from "@/hooks/useThemeColors";
import {
  buildVaultModel,
  computeVaultLayout,
  CONTAINER_ORDER,
  CONTAINER_LABEL,
  type VaultContainerId,
  type VaultCluster,
  type VaultSkill,
  type VaultSkillInput,
  type VaultNode,
} from "@/lib/skillVault";
import { SkillVaultDetailCard } from "./SkillVaultDetailCard";
import { ClusterDetailCard } from "./ClusterDetailCard";
import type { VaultViewMode } from "./SkillVaultScene";

// Lazy boundary keeps three.js / react-force-graph-3d out of the main bundle.
const SkillVaultScene = lazy(() => import("./SkillVaultScene"));

/**
 * SkillVaultView — orchestrator for the 3D Skill Vault. Owns the interaction
 * state (focused container, selected skill, search highlight), resolves theme +
 * reduced-motion, builds the graph model from the skills it's handed, and frames
 * the lazy 3D scene with overlay chrome. No three.js here.
 */
export function SkillVaultView({
  skills,
  onClose,
  initialQuery = "",
}: {
  skills: VaultSkillInput[];
  onClose: () => void;
  initialQuery?: string;
}) {
  const [focusedContainer, setFocusedContainer] = useState<VaultContainerId | null>(null);
  const [selected, setSelected] = useState<VaultSkill | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<VaultCluster | null>(null);
  const [mode, setMode] = useState<VaultViewMode>("constellation");
  const [query, setQuery] = useState(initialQuery);

  const model = useMemo(() => buildVaultModel(skills), [skills]);
  const data = useMemo(() => computeVaultLayout(model), [model]);
  const clusterByKey = useMemo(() => {
    const m = new Map<string, VaultCluster>();
    for (const c of model.containers) for (const cl of c.clusters) m.set(cl.key, cl);
    return m;
  }, [model]);

  const theme = useMemo(() => resolveThemeColors(), []);
  const bloomEnabled = useMemo(
    () => (typeof document !== "undefined" ? document.documentElement.dataset.theme !== "readable" : true),
    [],
  );
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  // search → highlight ids (skill node ids whose name/category/command matches)
  const highlightIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const ids = new Set<string>();
    for (const n of data.nodes) {
      if (n.type !== "skill" || !n.skill) continue;
      const s = n.skill;
      if (
        s.name.toLowerCase().includes(q) ||
        s.displayName.toLowerCase().includes(q) ||
        s.categoryLabel.toLowerCase().includes(q) ||
        (s.command ?? "").toLowerCase().includes(q)
      ) {
        ids.add(n.id);
      }
    }
    return ids;
  }, [query, data]);

  // Esc closes detail/cluster card, then focus, then the whole view.
  const escState = useRef({ selected, selectedCluster, focusedContainer });
  escState.current = { selected, selectedCluster, focusedContainer };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (escState.current.selected) setSelected(null);
      else if (escState.current.selectedCluster) setSelectedCluster(null);
      else if (escState.current.focusedContainer) setFocusedContainer(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const empty = model.total === 0;

  return (
    <div
      className="relative w-full h-[calc(100vh-13rem)] min-h-[520px] overflow-hidden rounded-[var(--radius)] border border-primary/20 bg-[#09090b]"
      style={{ boxShadow: "var(--glow-lg)" }}
    >
      {/* top-left: title + container focus chips */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} className="gap-1.5">
            <Boxes className="h-4 w-4" /> Grid
          </Button>
          <div className="flex items-center gap-1 rounded-[var(--radius)] border border-border/60 bg-background/70 p-1 backdrop-blur">
            {CONTAINER_ORDER.map((id) => {
              const c = model.containers.find((x) => x.id === id)!;
              const active = focusedContainer === id;
              return (
                <button
                  key={id}
                  onClick={() => setFocusedContainer(active ? null : id)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    active ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-pressed={active}
                >
                  {CONTAINER_LABEL[id]} <span className="opacity-60">{c.count}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1 rounded-[var(--radius)] border border-border/60 bg-background/70 p-1 backdrop-blur">
            {(
              [
                ["constellation", "Constellation"],
                ["usage", "Usage"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  mode === m ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
                aria-pressed={mode === m}
              >
                {label}
              </button>
            ))}
          </div>
          {focusedContainer && (
            <Button variant="ghost" size="sm" onClick={() => setFocusedContainer(null)} className="gap-1 text-muted-foreground">
              <RotateCcw className="h-3.5 w-3.5" /> Overview
            </Button>
          )}
        </div>

        {/* top-right: search */}
        <div className="pointer-events-auto relative w-56 max-w-[45vw]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Highlight skills…"
            className="w-full rounded-[var(--radius)] border border-border/60 bg-background/70 py-1.5 pl-8 pr-7 text-sm text-foreground backdrop-blur placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
            aria-label="Highlight skills in the vault"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear highlight"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* hint line */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 text-center text-[11px] text-muted-foreground/70">
        {mode === "usage"
          ? "Living mode · orb size & pulse = how much you use each skill"
          : focusedContainer
            ? "Click a skill for detail · drag to orbit · click empty space for overview"
            : "Click a vault to dive in · drag to orbit · scroll to zoom"}
        {highlightIds && ` · ${highlightIds.size} match${highlightIds.size === 1 ? "" : "es"}`}
      </div>

      {empty ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          No skills to show yet — install one to populate the vault.
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Spinning up the vault…
            </div>
          }
        >
          <SkillVaultScene
            data={data}
            focusedContainer={focusedContainer}
            selectedId={selected?.id ?? null}
            highlightIds={highlightIds}
            mode={mode}
            bloomEnabled={bloomEnabled}
            reducedMotion={reducedMotion}
            linkColor={theme.primary}
            onSelectSkill={(n: VaultNode) => {
              if (n.skill) {
                setSelected(n.skill);
                setSelectedCluster(null);
              }
            }}
            onSelectCluster={(n: VaultNode) => {
              const key = n.id.replace(/^cluster:/, "");
              const c = clusterByKey.get(key);
              if (c) {
                setSelectedCluster(c);
                setSelected(null);
              }
            }}
            onFocusContainer={(id) => setFocusedContainer(id)}
            onClearFocus={() => {
              setSelected(null);
              setSelectedCluster(null);
              setFocusedContainer(null);
            }}
          />
        </Suspense>
      )}

      {selected ? (
        <SkillVaultDetailCard skill={selected} onClose={() => setSelected(null)} />
      ) : selectedCluster ? (
        <ClusterDetailCard
          cluster={selectedCluster}
          onClose={() => setSelectedCluster(null)}
          onSelectSkill={(s) => {
            setSelected(s);
            setSelectedCluster(null);
          }}
        />
      ) : null}
    </div>
  );
}

export default SkillVaultView;
