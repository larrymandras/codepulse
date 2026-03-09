import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Html } from "@react-three/drei";
import * as THREE from "three";
import { useConstellation } from "../hooks/useForge";

const MAX_TOKENS = 200_000;

function pressureColor(tokens: number): string {
  const pct = tokens / MAX_TOKENS;
  if (pct < 0.3) return "#60a5fa";  // blue
  if (pct < 0.6) return "#a78bfa";  // purple
  if (pct < 0.8) return "#fbbf24";  // yellow
  return "#ef4444";                  // red
}

function pressureColorThree(tokens: number): THREE.Color {
  return new THREE.Color(pressureColor(tokens));
}

interface StarData {
  id: string;
  sessionId: string;
  position: [number, number, number];
  tokens: number;
  size: number;
  color: THREE.Color;
  timestamp: number;
}

function Stars({ stars }: { stars: StarData[] }) {
  const ref = useRef<THREE.Points>(null);

  const { positions, colors, sizes } = useMemo(() => {
    const pos = new Float32Array(stars.length * 3);
    const col = new Float32Array(stars.length * 3);
    const siz = new Float32Array(stars.length);

    stars.forEach((s, i) => {
      pos[i * 3] = s.position[0];
      pos[i * 3 + 1] = s.position[1];
      pos[i * 3 + 2] = s.position[2];
      col[i * 3] = s.color.r;
      col[i * 3 + 1] = s.color.g;
      col[i * 3 + 2] = s.color.b;
      siz[i] = s.size;
    });

    return { positions: pos, colors: col, sizes: siz };
  }, [stars]);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.02;
    }
  });

  if (stars.length === 0) return null;

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.15}
        vertexColors
        transparent
        opacity={0.9}
        sizeAttenuation
      />
    </points>
  );
}

function ConstellationLines({ stars }: { stars: StarData[] }) {
  const lineGeometry = useMemo(() => {
    // Group by session, draw lines within each session
    const sessions: Record<string, StarData[]> = {};
    for (const s of stars) {
      if (!sessions[s.sessionId]) sessions[s.sessionId] = [];
      sessions[s.sessionId].push(s);
    }

    const points: number[] = [];
    for (const sessionStars of Object.values(sessions)) {
      const sorted = sessionStars.sort((a, b) => a.timestamp - b.timestamp);
      for (let i = 0; i < sorted.length - 1; i++) {
        points.push(...sorted[i].position, ...sorted[i + 1].position);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(points, 3)
    );
    return geometry;
  }, [stars]);

  if (stars.length < 2) return null;

  return (
    <lineSegments geometry={lineGeometry}>
      <lineBasicMaterial color="#374151" transparent opacity={0.3} />
    </lineSegments>
  );
}

function SessionLabels({ stars }: { stars: StarData[] }) {
  const labels = useMemo(() => {
    const sessions: Record<string, { center: THREE.Vector3; count: number }> = {};
    for (const s of stars) {
      if (!sessions[s.sessionId]) {
        sessions[s.sessionId] = { center: new THREE.Vector3(), count: 0 };
      }
      sessions[s.sessionId].center.add(new THREE.Vector3(...s.position));
      sessions[s.sessionId].count++;
    }

    return Object.entries(sessions).map(([sid, { center, count }]) => ({
      sessionId: sid,
      position: center.divideScalar(count),
      count,
    }));
  }, [stars]);

  return (
    <>
      {labels.map((l) => (
        <Text
          key={l.sessionId}
          position={[l.position.x, l.position.y + 0.8, l.position.z]}
          fontSize={0.15}
          color="#6b7280"
          anchorX="center"
        >
          {`S-${l.sessionId.slice(-4)} (${l.count})`}
        </Text>
      ))}
    </>
  );
}

function ConstellationScene() {
  const snapshots = useConstellation();

  const stars = useMemo<StarData[]>(() => {
    // Group by session → assign cluster positions
    const sessions: Record<string, typeof snapshots> = {};
    for (const s of snapshots) {
      if (!sessions[s.sessionId]) sessions[s.sessionId] = [];
      sessions[s.sessionId].push(s);
    }

    const sessionIds = Object.keys(sessions);
    const result: StarData[] = [];

    sessionIds.forEach((sid, si) => {
      // Each session cluster gets a region in space
      const clusterAngle = (si / Math.max(sessionIds.length, 1)) * Math.PI * 2;
      const clusterRadius = 2 + (si % 3);
      const cx = Math.cos(clusterAngle) * clusterRadius;
      const cz = Math.sin(clusterAngle) * clusterRadius;
      const cy = (si % 2 === 0 ? 1 : -1) * (0.5 + Math.random());

      const snaps = sessions[sid];
      snaps.forEach((snap, i) => {
        const localAngle = (i / Math.max(snaps.length, 1)) * Math.PI * 2;
        const localR = 0.3 + (i / snaps.length) * 1.2;
        const tokens = snap.contextTokens;
        const size = 0.08 + Math.min(tokens / MAX_TOKENS, 1) * 0.2;

        result.push({
          id: snap.id as string,
          sessionId: snap.sessionId,
          position: [
            cx + Math.cos(localAngle) * localR,
            cy + (i * 0.1 - snaps.length * 0.05),
            cz + Math.sin(localAngle) * localR,
          ],
          tokens,
          size,
          color: pressureColorThree(tokens),
          timestamp: snap.timestamp,
        });
      });
    });

    return result;
  }, [snapshots]);

  return (
    <>
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 5, 0]} intensity={0.3} color="#a78bfa" />

      {/* Background stars */}
      <Stars stars={stars} />
      <ConstellationLines stars={stars} />
      <SessionLabels stars={stars} />

      {/* Bright individual stars for high-token snapshots */}
      {stars
        .filter((s) => s.tokens > MAX_TOKENS * 0.5)
        .map((s) => (
          <mesh key={s.id} position={s.position}>
            <sphereGeometry args={[s.size * 0.6, 8, 8]} />
            <meshStandardMaterial
              color={pressureColor(s.tokens)}
              emissive={pressureColor(s.tokens)}
              emissiveIntensity={0.8}
              transparent
              opacity={0.7}
            />
          </mesh>
        ))}

      <OrbitControls
        enablePan
        minDistance={2}
        maxDistance={15}
        autoRotate
        autoRotateSpeed={0.15}
      />
    </>
  );
}

export default function MemoryConstellation() {
  const snapshots = useConstellation();

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300">Memory Constellation</h2>
        <span className="text-[10px] text-gray-500">{snapshots.length} snapshots</span>
      </div>
      {snapshots.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">No context data yet.</p>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ height: 400 }}>
          <Canvas
            camera={{ position: [5, 3, 5], fov: 50 }}
            style={{ background: "radial-gradient(ellipse at center, #0f0a1a 0%, #030308 100%)" }}
          >
            <ConstellationScene />
          </Canvas>
        </div>
      )}
      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        <span className="text-[9px] text-gray-500 uppercase">Pressure:</span>
        {[
          { label: "<30%", color: "#60a5fa" },
          { label: "30-60%", color: "#a78bfa" },
          { label: "60-80%", color: "#fbbf24" },
          { label: ">80%", color: "#ef4444" },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1 text-[9px] text-gray-400">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
