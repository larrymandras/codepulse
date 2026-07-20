import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ForceGraph3DLib from "react-force-graph-3d";
import * as THREE from "three";
import {
  computeVaultLayout,
  containerCenter,
  CONTAINER_ORDER,
  type VaultContainerId,
  type VaultGraphData,
  type VaultNode,
} from "@/lib/skillVault";

/**
 * SkillVaultScene — the 3D render surface for the Skill Vault.
 *
 * ISOLATION RULE (mirrors graph/ForceGraph3D.tsx): this is the ONLY file under
 * components/skills permitted to import `react-force-graph-3d` or `three`. It is
 * default-exported and consumed exclusively through `React.lazy` in
 * SkillVaultView.tsx, keeping Three.js out of the main bundle.
 *
 * Physics is OFF: every node carries fixed fx/fy/fz (computeVaultLayout) and
 * cooldownTicks=0, so the layout is our bespoke static composition, not a force sim.
 * Custom nodeThreeObject meshes + additive halo sprites give the glow (the
 * post-processing bloom path renders black/white with this composer). LOD: skill
 * nodes are hidden until their container is focused; clicking a vault flies the
 * camera in. Objects are cached and mutated in place for selection/highlight, and
 * all geometries/materials are disposed on unmount (Phase-91 WebGL-leak discipline).
 */

export type VaultViewMode = "constellation" | "usage";

export interface SkillVaultSceneProps {
  data: VaultGraphData;
  focusedContainer: VaultContainerId | null;
  selectedId: string | null;
  highlightIds: Set<string> | null;
  mode: VaultViewMode;
  bloomEnabled: boolean;
  reducedMotion: boolean;
  linkColor: string; // hex
  onSelectSkill: (node: VaultNode) => void;
  onSelectCluster: (node: VaultNode) => void;
  onFocusContainer: (id: VaultContainerId) => void;
  onClearFocus: () => void;
}

interface CachedObject {
  group: THREE.Group;
  core: THREE.Mesh;
  baseColor: THREE.Color;
  node: VaultNode;
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  sprites: THREE.Sprite[];
  label?: THREE.Sprite;
}

/** Soft additive radial-gradient halo — gives a glow without post-processing. */
function makeGlowSprite(hex: string, size: number): THREE.Sprite {
  const s = 128;
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const g = canvas.getContext("2d")!;
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, hex);
  grad.addColorStop(0.2, hex);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  mat.blending = THREE.AdditiveBlending;
  mat.opacity = 0.55;
  const sp = new THREE.Sprite(mat);
  sp.scale.set(size, size, 1);
  (sp as any).raycast = () => {}; // never intercept clicks — the solid mesh is the target
  return sp;
}

function makeTextSprite(text: string, color: string, scale: number): THREE.Sprite {
  const pad = 24;
  const font = 64;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = `600 ${font}px Geist, system-ui, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  const h = font + pad * 2;
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d")!;
  g.font = `600 ${font}px Geist, system-ui, sans-serif`;
  g.textBaseline = "middle";
  g.textAlign = "center";
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.fillStyle = "#f4f4f5";
  g.fillText(text, w / 2, h / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  const aspect = w / h;
  sprite.scale.set(scale * aspect, scale, 1);
  (sprite as any).raycast = () => {}; // labels never intercept clicks
  return sprite;
}

export default function SkillVaultScene(props: SkillVaultSceneProps) {
  const {
    data,
    focusedContainer,
    selectedId,
    highlightIds,
    mode,
    bloomEnabled,
    reducedMotion,
    linkColor,
    onSelectSkill,
    onSelectCluster,
    onFocusContainer,
    onClearFocus,
  } = props;

  const fgRef = useRef<any>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cache = useRef<Map<string, CachedObject>>(new Map());
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Measure the container so react-force-graph fills it (it otherwise defaults to
  // the whole window, which overflows an offset panel).
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Live refs so accessors read current state without rebuilding the graph.
  const focusRef = useRef<VaultContainerId | null>(focusedContainer);
  focusRef.current = focusedContainer;
  const glowRef = useRef(bloomEnabled);
  glowRef.current = bloomEnabled;

  const flyMs = reducedMotion ? 0 : 900;

  // ---- node visibility (LOD): skills only when their container is focused ----
  const nodeVisibility = useMemo(
    () => (node: VaultNode) => {
      if (node.type !== "skill") return true;
      return focusRef.current === node.container;
    },
    [],
  );

  // ---- custom meshes (built once per node; cached for in-place mutation) ----
  const nodeThreeObject = useMemo(
    () => (node: VaultNode) => {
      const group = new THREE.Group();
      const geometries: THREE.BufferGeometry[] = [];
      const materials: THREE.Material[] = [];
      const sprites: THREE.Sprite[] = [];
      let labelSprite: THREE.Sprite | undefined;
      const color = new THREE.Color(node.color);

      let core: THREE.Mesh;
      if (node.type === "container") {
        // holographic portal: a vertical torus ring facing the camera that frames
        // the cluster cloud, a soft glow behind it, a faint floor disc, and a label.
        const frameR = 160;
        if (glowRef.current) {
          const halo = makeGlowSprite(node.color, frameR * 2.6);
          halo.material.opacity = 0.28;
          sprites.push(halo);
          group.add(halo);
        }
        const ringGeo = new THREE.TorusGeometry(frameR, 2.2, 16, 120);
        const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 });
        core = new THREE.Mesh(ringGeo, ringMat); // vertical (faces camera) — no rotation
        geometries.push(ringGeo);
        materials.push(ringMat);

        const discGeo = new THREE.CircleGeometry(frameR * 1.05, 64);
        const discMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.05, side: THREE.DoubleSide });
        const disc = new THREE.Mesh(discGeo, discMat);
        disc.rotation.x = Math.PI / 2;
        disc.position.y = -frameR;
        geometries.push(discGeo);
        materials.push(discMat);
        group.add(disc);

        const label = makeTextSprite(`${node.label}  ·  ${node.count ?? 0}`, node.color, 46);
        label.position.set(0, frameR + 40, 0);
        labelSprite = label;
        sprites.push(label);
        group.add(label);
      } else if (node.type === "cluster") {
        const r = 9 + Math.min(node.count ?? 0, 30) * 0.7; // ~9–30
        if (glowRef.current) {
          const glow = makeGlowSprite(node.color, r * 3.2);
          glow.material.opacity = 0.45;
          sprites.push(glow);
          group.add(glow);
        }
        const geo = new THREE.SphereGeometry(r, 32, 24);
        const mat = new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.45,
          roughness: 0.3,
          metalness: 0.0,
        });
        core = new THREE.Mesh(geo, mat);
        geometries.push(geo);
        materials.push(mat);
        const label = makeTextSprite(node.label, node.color, 13);
        label.position.set(0, r + 11, 0);
        label.material.opacity = 0.9;
        labelSprite = label;
        sprites.push(label);
        group.add(label);
      } else {
        const r = 4.5 + Math.min(node.skill?.useCount ?? 0, 20) * 0.25; // ~4.5–9.5
        if (glowRef.current) {
          const glow = makeGlowSprite(node.color, r * 2.8);
          glow.material.opacity = 0.4;
          sprites.push(glow);
          group.add(glow);
        }
        const geo = new THREE.SphereGeometry(r, 24, 18);
        const mat = new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.5,
          roughness: 0.35,
          metalness: 0.0,
        });
        core = new THREE.Mesh(geo, mat);
        geometries.push(geo);
        materials.push(mat);
      }

      group.add(core);
      cache.current.set(node.id, {
        group,
        core,
        baseColor: color.clone(),
        node,
        geometries,
        materials,
        sprites,
        label: labelSprite,
      });
      return group;
    },
    [],
  );

  // ---- selection / highlight: mutate cached objects in place (no rebuild) ----
  useEffect(() => {
    const hasHighlight = highlightIds && highlightIds.size > 0;
    for (const [id, obj] of cache.current) {
      const isSelected = id === selectedId;
      const isHit = !hasHighlight || (obj.node.type !== "skill") || highlightIds!.has(id);
      const mat = obj.core.material as THREE.MeshBasicMaterial & { emissive?: THREE.Color };
      // dim non-matches when a search highlight is active
      const dim = hasHighlight && !isHit;
      mat.color.copy(obj.baseColor);
      if (mat.emissive) {
        mat.emissive.copy(obj.baseColor);
        if (dim) mat.emissive.multiplyScalar(0.12);
      }
      if (dim) mat.color.multiplyScalar(0.25);
      mat.opacity = dim ? 0.35 : (obj.node.type === "container" ? mat.opacity : 1);
      mat.transparent = dim || obj.node.type === "container";
      // selected skill pops in scale
      const s = isSelected ? 1.8 : hasHighlight && isHit && obj.node.type === "skill" ? 1.35 : 1;
      obj.group.scale.setScalar(s);
    }
  }, [selectedId, highlightIds, data]);

  // ---- Living/Usage mode: size + pulse + brighten orbs by usage ----
  useEffect(() => {
    const baseEmissive = (t: VaultNode["type"]) => (t === "cluster" ? 0.45 : 0.5);
    // reset to neutral first (leaving constellation, or before applying usage)
    for (const obj of cache.current.values()) {
      obj.group.scale.setScalar(1);
      const m = obj.core.material as { emissiveIntensity?: number };
      if (m.emissiveIntensity !== undefined) m.emissiveIntensity = baseEmissive(obj.node.type);
    }
    if (mode !== "usage") return;

    const sizeFor = (usage: number) => 0.8 + (Math.min(usage, 40) / 40) * 1.5; // 0.8×–2.3×
    if (reducedMotion) {
      for (const obj of cache.current.values()) {
        const n = obj.node;
        if (n.type !== "skill" && n.type !== "cluster") continue;
        const u = Math.min(n.usage ?? 0, 40) / 40;
        obj.group.scale.setScalar(sizeFor(n.usage ?? 0));
        const m = obj.core.material as { emissiveIntensity?: number };
        if (m.emissiveIntensity !== undefined) m.emissiveIntensity = 0.35 + u * 0.95;
      }
      return;
    }
    let raf = 0;
    const loop = () => {
      const t = performance.now() / 1000;
      for (const obj of cache.current.values()) {
        const n = obj.node;
        if (n.type !== "skill" && n.type !== "cluster") continue;
        const usage = n.usage ?? 0;
        const u = Math.min(usage, 40) / 40;
        const base = sizeFor(usage);
        const amp = 0.03 + u * 0.14; // heavy-hitters pulse harder
        const phase = (n.fx + n.fy) * 0.01; // desync per orb
        const wob = Math.sin(t * 2.2 + phase);
        obj.group.scale.setScalar(base * (1 + wob * amp));
        const m = obj.core.material as { emissiveIntensity?: number };
        if (m.emissiveIntensity !== undefined) m.emissiveIntensity = 0.35 + u * 0.9 + wob * 0.12 * u;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mode, reducedMotion, data]);

  // ---- camera fly-to / framing on focus (or once the canvas is measured) ----
  // Positions are our fixed layout (verified), so we drive the camera explicitly
  // rather than zoomToFit (which over-pulls on the wide 3-vault spread).
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !size.w) return;
    fg.refresh?.(); // apply LOD visibility first
    const move = () => {
      if (focusedContainer) {
        const c = containerCenter(focusedContainer, { containerGap: 340, clusterOrbit: 96, arcBow: 70 });
        fg.cameraPosition({ x: c.x, y: c.y + 20, z: c.z + 560 }, { x: c.x, y: c.y, z: c.z }, flyMs);
      } else {
        fg.cameraPosition({ x: 0, y: 40, z: 900 }, { x: 0, y: 0, z: 0 }, flyMs);
      }
    };
    const t = setTimeout(move, 100);
    return () => clearTimeout(t);
  }, [focusedContainer, flyMs, size.w, size.h]);

  // ---- debug handle + WebGL disposal on unmount ----
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    // Glow comes from additive halo sprites in nodeThreeObject (robust), not an
    // UnrealBloomPass — the post-processing composer path renders black/white here.
    const objectsAtMount = cache.current;
    return () => {
      for (const obj of objectsAtMount.values()) {
        obj.geometries.forEach((g) => g.dispose());
        obj.materials.forEach((m) => m.dispose());
        obj.sprites.forEach((s) => {
          (s.material.map as THREE.Texture | null)?.dispose();
          s.material.dispose();
        });
      }
      objectsAtMount.clear();
    };
  }, []);

  const handleNodeClick = (node: VaultNode) => {
    if (node.type === "skill") {
      onSelectSkill(node);
      return;
    }
    if (node.type === "cluster") {
      onSelectCluster(node);
      if (focusRef.current !== node.container) {
        onFocusContainer(node.container);
      } else {
        // already inside this vault — zoom in on the clicked cluster for feedback
        fgRef.current?.cameraPosition(
          { x: node.fx, y: node.fy, z: node.fz + 180 },
          { x: node.fx, y: node.fy, z: node.fz },
          flyMs,
        );
      }
      return;
    }
    onFocusContainer(node.container); // container ring
  };

  const nodeLabel = (node: VaultNode) => {
    if (node.type === "skill") {
      const s = node.skill!;
      return `<div style="font:600 13px Geist,sans-serif;color:#f4f4f5">${s.displayName}</div>`
        + `<div style="font:12px Geist,sans-serif;color:#a1a1aa">${s.categoryLabel} · used ${s.useCount}×</div>`;
    }
    if (node.type === "cluster") return `<div style="font:600 12px Geist;color:#e4e4e7">${node.label} · ${node.count}</div>`;
    return `<div style="font:600 13px Geist;color:#e4e4e7">${node.label} · ${node.count} skills</div>`;
  };

  return (
    <div ref={wrapRef} className="h-full w-full">
      <ForceGraph3DLib
        ref={fgRef}
        width={size.w || undefined}
        height={size.h || undefined}
        graphData={data}
        nodeId="id"
        nodeThreeObject={nodeThreeObject}
        nodeVisibility={nodeVisibility}
        nodeLabel={nodeLabel}
        linkColor={() => linkColor}
        linkOpacity={0.35}
        linkWidth={0.8}
        linkDirectionalParticles={reducedMotion ? 0 : 2}
        linkDirectionalParticleWidth={1.4}
        linkDirectionalParticleSpeed={0.006}
        backgroundColor="#09090b"
        enableNodeDrag={false}
        cooldownTicks={0}
        warmupTicks={0}
        onEngineStop={() => {
          // react-force-graph auto-frames on load; re-assert our overview camera.
          if (!focusRef.current) fgRef.current?.cameraPosition({ x: 0, y: 40, z: 900 }, { x: 0, y: 0, z: 0 }, 0);
        }}
        onNodeClick={(n: any) => handleNodeClick(n as VaultNode)}
        onBackgroundClick={() => onClearFocus()}
      />
    </div>
  );
}

// re-export for convenience (view builds layout from model)
export { computeVaultLayout, CONTAINER_ORDER };
