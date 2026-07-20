// Skill Vault — pure model + 3D layout math for the three-container 3D view.
//
// This module has NO three.js / react-force-graph dependency: it transforms the
// enriched skills from `api.skillCategories.getSkillsWithOverrides` into (1) a
// legible container→cluster→skill MODEL and (2) a react-force-graph `graphData`
// with FIXED node positions (physics is off in the scene). Kept pure so it can be
// unit-tested without a WebGL context.
//
// Container mapping (from `origins`):
//   claude-code:available        -> cold   (DORMANT_ORIGIN)
//   claude-code:project:<key>    -> project
//   anything else (claude-code, native, bridge, cc, catalog, …) -> global
// A skill may belong to more than one container (multi-origin); a skill present in
// cold AND a non-cold container is "shadowing" and gets a tether between the two.

import { categoryHex } from "@/lib/categoryColors";

// Vivid fallback palette for categories with no color (or plain "gray") so the
// vault reads as colorful constellations rather than a gray blob. Deterministic
// by category key.
const VAULT_PALETTE = [
  "#06b6d4", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#3b82f6",
  "#ec4899", "#14b8a6", "#f97316", "#a855f7", "#22c55e", "#eab308",
];
function colorForCategory(categoryColor: string | null | undefined, key: string): string {
  if (categoryColor && categoryColor !== "gray") return categoryHex(categoryColor);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return VAULT_PALETTE[h % VAULT_PALETTE.length]!;
}

export const DORMANT_ORIGIN = "claude-code:available";
const PROJECT_PREFIX = "claude-code:project:";

export type VaultContainerId = "global" | "project" | "cold";

export const CONTAINER_ORDER: VaultContainerId[] = ["global", "project", "cold"];

export const CONTAINER_LABEL: Record<VaultContainerId, string> = {
  global: "Global",
  project: "Project",
  cold: "Cold Storage",
};

/** Minimal shape this module needs off an enriched skill. */
export interface VaultSkillInput {
  name: string;
  displayName?: string;
  description?: string;
  overrideDescription?: string | null;
  origins?: string[];
  categoryName?: string | null;
  categoryDisplayName?: string | null;
  categoryColor?: string | null;
  categoryIcon?: string | null;
  useCount?: number;
  lastUsedAt?: number;
  command?: string;
  upstream?: string;
}

export interface VaultSkill {
  id: string; // `${container}:${name}`
  name: string;
  displayName: string;
  container: VaultContainerId;
  categoryKey: string; // categoryName ?? "__uncat__"
  categoryLabel: string;
  color: string; // hex
  icon: string;
  description: string;
  useCount: number;
  lastUsedAt: number | null;
  command: string | null;
  upstream: string | null;
}

export interface VaultCluster {
  key: string; // `${container}:${categoryKey}`
  categoryKey: string;
  categoryLabel: string;
  container: VaultContainerId;
  color: string;
  skills: VaultSkill[];
}

export interface VaultContainer {
  id: VaultContainerId;
  label: string;
  count: number;
  clusters: VaultCluster[];
}

export interface VaultShadowLink {
  fromId: string; // cold skill node id
  toId: string; // the non-cold twin's node id
  name: string;
}

export interface VaultModel {
  containers: VaultContainer[];
  shadowLinks: VaultShadowLink[];
  total: number;
}

const UNCAT = "__uncat__";

function classifyOrigin(origin: string): VaultContainerId {
  if (origin === DORMANT_ORIGIN) return "cold";
  if (origin.startsWith(PROJECT_PREFIX)) return "project";
  return "global";
}

/** Distinct containers a skill belongs to, derived from its origins. */
export function containersForSkill(origins: string[] | undefined): VaultContainerId[] {
  const set = new Set<VaultContainerId>();
  for (const o of origins ?? []) set.add(classifyOrigin(o));
  // A skill with no origins at all still counts as an installed (global) skill.
  if (set.size === 0) set.add("global");
  return CONTAINER_ORDER.filter((c) => set.has(c));
}

/**
 * Build the container → cluster → skill model from enriched skills.
 * Deterministic ordering: containers in CONTAINER_ORDER; clusters sorted by skill
 * count desc then label; skills sorted by useCount desc then name.
 */
export function buildVaultModel(skills: VaultSkillInput[]): VaultModel {
  const byContainer: Record<VaultContainerId, Map<string, VaultCluster>> = {
    global: new Map(),
    project: new Map(),
    cold: new Map(),
  };
  const shadowLinks: VaultShadowLink[] = [];
  let total = 0;

  for (const s of skills) {
    const containers = containersForSkill(s.origins);
    const categoryKey = s.categoryName ?? UNCAT;
    const categoryLabel =
      s.categoryDisplayName ?? s.categoryName ?? "Uncategorized";
    const color = colorForCategory(s.categoryColor, categoryKey);
    const icon = s.categoryIcon ?? "⚡";
    const displayName = s.displayName ?? s.name;
    const description = s.overrideDescription ?? s.description ?? "";

    const placedIds: Partial<Record<VaultContainerId, string>> = {};
    for (const container of containers) {
      const id = `${container}:${s.name}`;
      placedIds[container] = id;
      const skill: VaultSkill = {
        id,
        name: s.name,
        displayName,
        container,
        categoryKey,
        categoryLabel,
        color,
        icon,
        description,
        useCount: s.useCount ?? 0,
        lastUsedAt: s.lastUsedAt ?? null,
        command: s.command ?? null,
        upstream: s.upstream ?? null,
      };
      const clusters = byContainer[container];
      const cKey = `${container}:${categoryKey}`;
      let cluster = clusters.get(cKey);
      if (!cluster) {
        cluster = {
          key: cKey,
          categoryKey,
          categoryLabel,
          container,
          color,
          skills: [],
        };
        clusters.set(cKey, cluster);
      }
      cluster.skills.push(skill);
      total += 1;
    }

    // Shadow tether: a skill in cold AND a non-cold container.
    if (placedIds.cold) {
      const twin = placedIds.global ?? placedIds.project;
      if (twin) {
        shadowLinks.push({ fromId: placedIds.cold, toId: twin, name: s.name });
      }
    }
  }

  const containers: VaultContainer[] = CONTAINER_ORDER.map((id) => {
    const clusters = Array.from(byContainer[id].values()).sort(
      (a, b) => b.skills.length - a.skills.length || a.categoryLabel.localeCompare(b.categoryLabel),
    );
    for (const c of clusters) {
      c.skills.sort((a, b) => b.useCount - a.useCount || a.name.localeCompare(b.name));
    }
    const count = clusters.reduce((n, c) => n + c.skills.length, 0);
    return { id, label: CONTAINER_LABEL[id], count, clusters };
  });

  return { containers, shadowLinks, total };
}

// ---------------------------------------------------------------------------
// Layout — deterministic fixed positions for react-force-graph (physics off).
// ---------------------------------------------------------------------------

export type VaultNodeType = "container" | "cluster" | "skill";

export interface VaultNode {
  id: string;
  type: VaultNodeType;
  container: VaultContainerId;
  label: string;
  color: string;
  /** Base render size (radius multiplier). */
  size: number;
  /** Fixed position — physics is disabled in the scene. */
  fx: number;
  fy: number;
  fz: number;
  /** Initial position mirror of fx/fy/fz — set so nodes render with 0 sim ticks. */
  x?: number;
  y?: number;
  z?: number;
  // convenience payload for interaction/detail (skills only)
  skill?: VaultSkill;
  categoryKey?: string;
  count?: number;
  /** Total usage for "Living/Usage" mode — skill.useCount, or a cluster's sum. */
  usage?: number;
}

export interface VaultLink {
  source: string;
  target: string;
  kind: "shadow";
}

export interface VaultGraphData {
  nodes: VaultNode[];
  links: VaultLink[];
}

export interface VaultLayoutOptions {
  /** Horizontal distance between adjacent container centers. */
  containerGap?: number;
  /** Radius of the ring the category clusters sit on around a container center. */
  clusterOrbit?: number;
  /** Forward bow of the arc (container z offset for the middle container). */
  arcBow?: number;
}

const DEFAULTS: Required<VaultLayoutOptions> = {
  containerGap: 340,
  clusterOrbit: 96,
  arcBow: 70,
};

/** Center position of a container along the gentle forward arc. */
export function containerCenter(
  id: VaultContainerId,
  opts: Required<VaultLayoutOptions>,
): { x: number; y: number; z: number } {
  const idx = CONTAINER_ORDER.indexOf(id); // 0,1,2
  const x = (idx - 1) * opts.containerGap;
  // middle container bowed toward the viewer (−z is toward camera in default view)
  const z = idx === 1 ? -opts.arcBow : 0;
  return { x, y: 0, z };
}

/**
 * Turn a model into react-force-graph `graphData` with fixed positions.
 * - container nodes at each center
 * - cluster nodes on a ring around their container center, radius scaled a touch by count
 * - skill nodes on a small sphere around their cluster, deterministic by index
 */
export function computeVaultLayout(
  model: VaultModel,
  options: VaultLayoutOptions = {},
): VaultGraphData {
  const opts = { ...DEFAULTS, ...options };
  const nodes: VaultNode[] = [];
  const idToNode = new Map<string, VaultNode>();

  const CONTAINER_COLOR: Record<VaultContainerId, string> = {
    global: "#22d3ee", // cyan
    project: "#a78bfa", // violet
    cold: "#fbbf24", // amber
  };
  for (const container of model.containers) {
    const center = containerCenter(container.id, opts);
    nodes.push({
      id: `container:${container.id}`,
      type: "container",
      container: container.id,
      label: container.label,
      color: CONTAINER_COLOR[container.id],
      size: 6,
      fx: center.x,
      fy: center.y,
      fz: center.z,
      count: container.count,
    });

    const nClusters = container.clusters.length || 1;
    container.clusters.forEach((cluster, ci) => {
      // distribute clusters on a ring in the X/Y plane, slight golden-angle twist
      const angle = (ci / nClusters) * Math.PI * 2 + ci * 2.399963;
      const r = opts.clusterOrbit * (0.8 + Math.min(cluster.skills.length, 24) / 40);
      const cx = center.x + Math.cos(angle) * r;
      const cy = center.y + Math.sin(angle) * r * 0.7;
      const cz = center.z + Math.sin(angle * 1.3) * (opts.clusterOrbit * 0.35);
      const clusterId = `cluster:${cluster.key}`;
      const cNode: VaultNode = {
        id: clusterId,
        type: "cluster",
        container: container.id,
        label: cluster.categoryLabel,
        color: cluster.color,
        size: 2.2 + Math.min(cluster.skills.length, 30) * 0.12,
        fx: cx,
        fy: cy,
        fz: cz,
        categoryKey: cluster.categoryKey,
        count: cluster.skills.length,
        usage: cluster.skills.reduce((n, s) => n + s.useCount, 0),
      };
      nodes.push(cNode);
      idToNode.set(clusterId, cNode);

      const nSkills = cluster.skills.length || 1;
      cluster.skills.forEach((skill, si) => {
        // deterministic fibonacci-sphere distribution around the cluster center
        const k = si + 0.5;
        const phi = Math.acos(1 - (2 * k) / nSkills);
        const theta = Math.PI * (1 + Math.sqrt(5)) * k;
        const sr = 14 + Math.min(nSkills, 30) * 0.9;
        const sx = cx + Math.cos(theta) * Math.sin(phi) * sr;
        const sy = cy + Math.sin(theta) * Math.sin(phi) * sr;
        const sz = cz + Math.cos(phi) * sr;
        nodes.push({
          id: skill.id,
          type: "skill",
          container: container.id,
          label: skill.displayName,
          color: skill.color,
          size: 1.1 + Math.min(skill.useCount, 20) * 0.06,
          fx: sx,
          fy: sy,
          fz: sz,
          skill,
          categoryKey: cluster.categoryKey,
          usage: skill.useCount,
        });
      });
    });
  }

  // Mirror fixed positions into x/y/z so react-force-graph renders them even with
  // 0 simulation ticks (fx/fy/fz alone only pin the sim, which never runs here).
  for (const n of nodes) {
    n.x = n.fx;
    n.y = n.fy;
    n.z = n.fz;
  }

  const links: VaultLink[] = model.shadowLinks.map((l) => ({
    source: l.fromId,
    target: l.toId,
    kind: "shadow" as const,
  }));

  return { nodes, links };
}
