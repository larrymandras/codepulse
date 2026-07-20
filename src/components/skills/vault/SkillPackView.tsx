import { useMemo, useState } from "react";
import { packCircles } from "@/lib/circlePack";
import {
  CONTAINER_ORDER,
  type VaultContainerId,
  type VaultCluster,
  type VaultModel,
  type VaultSkill,
} from "@/lib/skillVault";
import { SkillVaultDetailCard } from "./SkillVaultDetailCard";
import { ClusterDetailCard } from "./ClusterDetailCard";

const CONTAINER_COLOR: Record<VaultContainerId, string> = {
  global: "#22d3ee",
  project: "#a78bfa",
  cold: "#fbbf24",
};

// Fixed nominal viewport; SVG scales responsively to the container.
const VW = 1200;
const VH = 680;

interface PSkill {
  skill: VaultSkill;
  x: number;
  y: number;
  r: number;
}
interface PCat {
  cluster: VaultCluster;
  x: number;
  y: number;
  r: number;
  color: string;
  skills: PSkill[];
}
interface PCont {
  id: VaultContainerId;
  label: string;
  color: string;
  count: number;
  x: number;
  y: number;
  r: number;
  cats: PCat[];
}
interface Focus {
  x: number;
  y: number;
  r: number;
  /** Bounding-box extents — set for the whole-scene focus so it fits width, not a circle. */
  w?: number;
  h?: number;
}

const skillR = (useCount: number) => 3 + Math.min(useCount, 30) * 0.5; // 3–18

function buildLayout(model: VaultModel): { conts: PCont[]; scene: Focus } {
  // 1) pack skills within each category, then categories within each container
  const prepared = CONTAINER_ORDER.map((id) => {
    const container = model.containers.find((c) => c.id === id)!;
    const cats = container.clusters.map((cluster) => {
      const skillCircles = cluster.skills.map((s) => ({ r: skillR(s.useCount), skill: s, x: 0, y: 0 }));
      const innerR = packCircles(skillCircles, 1.5);
      return { cluster, r: innerR + 6, color: cluster.color, skillCircles };
    });
    const catCircles = cats.map((c) => ({ r: c.r, cat: c, x: 0, y: 0 }));
    const innerR = packCircles(catCircles, 9);
    return { id, label: container.label, count: container.count, color: CONTAINER_COLOR[id], r: innerR + 30, catCircles };
  });

  // 2) place containers left-to-right, centered
  const gap = 80;
  const positions: number[] = [];
  let cursor = 0;
  prepared.forEach((p, i) => {
    if (i > 0) cursor += gap + prepared[i - 1]!.r + p.r;
    positions.push(cursor);
  });
  const offset = (positions[positions.length - 1] ?? 0) / 2;

  const conts: PCont[] = prepared.map((p, i) => {
    const cx = (positions[i] ?? 0) - offset;
    const cy = 0;
    const cats: PCat[] = p.catCircles.map((cc) => {
      const catAbsX = cx + cc.x;
      const catAbsY = cy + cc.y;
      const skills: PSkill[] = cc.cat.skillCircles.map((sc) => ({
        skill: sc.skill,
        x: catAbsX + sc.x,
        y: catAbsY + sc.y,
        r: sc.r,
      }));
      return { cluster: cc.cat.cluster, x: catAbsX, y: catAbsY, r: cc.cat.r, color: cc.cat.color, skills };
    });
    return { id: p.id, label: p.label, color: p.color, count: p.count, x: cx, y: cy, r: p.r, cats };
  });

  let minX = Infinity;
  let maxX = -Infinity;
  let maxR = 0;
  for (const c of conts) {
    minX = Math.min(minX, c.x - c.r);
    maxX = Math.max(maxX, c.x + c.r);
    maxR = Math.max(maxR, c.r);
  }
  const scene: Focus = {
    x: (minX + maxX) / 2,
    y: 0,
    r: Math.max((maxX - minX) / 2, maxR),
    w: maxX - minX,
    h: maxR * 2,
  };
  return { conts, scene };
}

export function SkillPackView({
  model,
  query,
}: {
  model: VaultModel;
  query: string;
}) {
  const { conts, scene } = useMemo(() => buildLayout(model), [model]);
  const [focus, setFocus] = useState<Focus>(scene);
  const [selected, setSelected] = useState<VaultSkill | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<VaultCluster | null>(null);

  const q = query.trim().toLowerCase();
  const matches = (s: VaultSkill) =>
    !q ||
    s.name.toLowerCase().includes(q) ||
    s.displayName.toLowerCase().includes(q) ||
    s.categoryLabel.toLowerCase().includes(q) ||
    (s.command ?? "").toLowerCase().includes(q);

  const k =
    focus.w && focus.h
      ? Math.min(VW / (focus.w * 1.1), VH / (focus.h * 1.1))
      : Math.min(VW, VH) / (2 * focus.r * 1.12);
  const transform = `translate(${VW / 2} ${VH / 2}) scale(${k}) translate(${-focus.x} ${-focus.y})`;
  const zoomed = focus !== scene;

  const reset = () => {
    setFocus(scene);
    setSelected(null);
    setSelectedCluster(null);
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        onClick={reset}
      >
        <g style={{ transition: "transform 600ms cubic-bezier(0.4,0,0.2,1)" }} transform={transform}>
          {conts.map((cont) => (
            <g key={cont.id}>
              <circle
                cx={cont.x}
                cy={cont.y}
                r={cont.r}
                fill={cont.color}
                fillOpacity={0.04}
                stroke={cont.color}
                strokeOpacity={0.55}
                strokeWidth={1.5 / k}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(null);
                  setSelectedCluster(null);
                  setFocus({ x: cont.x, y: cont.y, r: cont.r });
                }}
              />
              <text
                x={cont.x}
                y={cont.y - cont.r - 8}
                textAnchor="middle"
                className="pointer-events-none select-none font-semibold"
                fill={cont.color}
                style={{ fontSize: 22, fontFamily: "Geist, sans-serif" }}
              >
                {cont.label} · {cont.count}
              </text>

              {cont.cats.map((cat) => (
                <g key={cat.cluster.key}>
                  <circle
                    cx={cat.x}
                    cy={cat.y}
                    r={cat.r}
                    fill={cat.color}
                    fillOpacity={0.14}
                    stroke={cat.color}
                    strokeOpacity={0.4}
                    strokeWidth={1 / k}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(null);
                      setSelectedCluster(cat.cluster);
                      setFocus({ x: cat.x, y: cat.y, r: cat.r });
                    }}
                  >
                    <title>{cat.cluster.categoryLabel} · {cat.cluster.skills.length} skills</title>
                  </circle>

                  {cat.skills.map((ps) => {
                    const hit = matches(ps.skill);
                    return (
                      <circle
                        key={ps.skill.id}
                        cx={ps.x}
                        cy={ps.y}
                        r={ps.r}
                        fill={cat.color}
                        fillOpacity={hit ? 0.95 : 0.15}
                        className="cursor-pointer"
                        style={{ filter: hit ? `drop-shadow(0 0 ${ps.r * 0.5}px ${cat.color})` : undefined }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCluster(null);
                          setSelected(ps.skill);
                        }}
                      >
                        <title>{ps.skill.displayName} · used {ps.skill.useCount}×</title>
                      </circle>
                    );
                  })}

                  <text
                    x={cat.x}
                    y={cat.y - cat.r - 3}
                    textAnchor="middle"
                    className="pointer-events-none select-none"
                    fill={cat.color}
                    fillOpacity={0.9}
                    style={{ fontSize: Math.max(7, cat.r * 0.18), fontFamily: "Geist, sans-serif" }}
                  >
                    {cat.cluster.categoryLabel}
                  </text>
                </g>
              ))}
            </g>
          ))}
        </g>
      </svg>

      {/* hint */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 text-center text-[11px] text-muted-foreground/70">
        {zoomed ? "Click a skill for detail · click empty space to zoom out" : "Click a vault or category to zoom in · click a skill for detail"}
        {q && ` · highlighting “${query}”`}
      </div>

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

export default SkillPackView;
