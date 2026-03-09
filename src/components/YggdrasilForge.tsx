import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Float } from "@react-three/drei";
import * as THREE from "three";
import { useYggdrasilTree } from "../hooks/useForge";

const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  completed: "#eab308",
  errored: "#ef4444",
  running: "#22c55e",
  failed: "#ef4444",
};

function Trunk() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.05;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <cylinderGeometry args={[0.3, 0.5, 6, 12]} />
      <meshStandardMaterial color="#8b5a2b" roughness={0.8} />
    </mesh>
  );
}

function Branch({
  position,
  rotation,
  length,
  color,
  thickness = 0.08,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  length: number;
  color: string;
  thickness?: number;
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <cylinderGeometry args={[thickness * 0.6, thickness, length, 6]} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  );
}

function SessionNode({
  position,
  status,
  agentCount,
  label,
}: {
  position: [number, number, number];
  status: string;
  agentCount: number;
  label: string;
}) {
  const color = STATUS_COLORS[status] ?? "#6b7280";
  const size = 0.15 + Math.min(agentCount * 0.03, 0.15);

  return (
    <Float speed={1.5} floatIntensity={0.3}>
      <group position={position}>
        <mesh>
          <sphereGeometry args={[size, 16, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={status === "active" || status === "running" ? 0.5 : 0.15}
            roughness={0.3}
          />
        </mesh>
        <Text
          position={[0, size + 0.15, 0]}
          fontSize={0.1}
          color="#9ca3af"
          anchorX="center"
          anchorY="bottom"
        >
          {label}
        </Text>
      </group>
    </Float>
  );
}

function AgentLeaf({
  position,
  status,
}: {
  position: [number, number, number];
  status: string;
}) {
  const color = STATUS_COLORS[status] ?? "#6b7280";

  return (
    <mesh position={position}>
      <sphereGeometry args={[0.06, 8, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={status === "running" ? 0.8 : 0.2}
        roughness={0.4}
      />
    </mesh>
  );
}

function Particles({ count, activity }: { count: number; activity: number }) {
  const ref = useRef<THREE.Points>(null);
  const particleCount = Math.min(count + activity * 2, 200);

  const positions = useMemo(() => {
    const arr = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.2 + Math.random() * 2;
      const height = -2 + Math.random() * 7;
      arr[i * 3] = Math.cos(angle) * radius;
      arr[i * 3 + 1] = height;
      arr[i * 3 + 2] = Math.sin(angle) * radius;
    }
    return arr;
  }, [particleCount]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position;
    for (let i = 0; i < particleCount; i++) {
      const y = pos.getY(i) + delta * (0.3 + Math.random() * 0.5);
      pos.setY(i, y > 5 ? -2 : y);
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color="#a78bfa"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

function TreeScene() {
  const data = useYggdrasilTree();

  const sessionPositions = useMemo(() => {
    return data.sessions.map((s, i) => {
      const angle = (i / Math.max(data.sessions.length, 1)) * Math.PI * 2;
      const tier = i < 5 ? 2 : 1;
      const radius = 1.2 + tier * 0.8;
      const y = 1 + tier * 1.2;
      return {
        session: s,
        pos: [
          Math.cos(angle) * radius,
          y,
          Math.sin(angle) * radius,
        ] as [number, number, number],
        branchAngle: angle,
      };
    });
  }, [data.sessions]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 8, 0]} intensity={1} color="#a78bfa" />
      <pointLight position={[4, 2, 4]} intensity={0.5} color="#22c55e" />
      <pointLight position={[-4, 2, -4]} intensity={0.5} color="#60a5fa" />

      {/* Trunk */}
      <Trunk />

      {/* Crown glow */}
      <mesh position={[0, 4, 0]}>
        <sphereGeometry args={[2.5, 16, 16]} />
        <meshStandardMaterial
          color="#1a1a2e"
          transparent
          opacity={0.1}
          emissive="#4c1d95"
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* Branches + Session nodes */}
      {sessionPositions.map(({ session, pos, branchAngle }, i) => {
        const branchLen = Math.sqrt(pos[0] ** 2 + pos[2] ** 2) * 0.7;
        const branchY = pos[1] - 0.5;
        const tiltAngle = Math.atan2(pos[1] - 0.5, branchLen);

        return (
          <group key={session.sessionId}>
            <Branch
              position={[
                Math.cos(branchAngle) * branchLen * 0.5,
                branchY,
                Math.sin(branchAngle) * branchLen * 0.5,
              ]}
              rotation={[0, 0, -(Math.PI / 2 - tiltAngle)]}
              length={branchLen}
              color="#6b4226"
              thickness={0.06 + session.agents.length * 0.01}
            />
            <SessionNode
              position={pos}
              status={session.status}
              agentCount={session.agents.length}
              label={`S-${session.sessionId.slice(-4)}`}
            />
            {/* Agent leaves around session node */}
            {session.agents.slice(0, 8).map((agent, ai) => {
              const leafAngle = (ai / Math.max(session.agents.length, 1)) * Math.PI * 2;
              const leafR = 0.35;
              return (
                <AgentLeaf
                  key={agent.agentId}
                  position={[
                    pos[0] + Math.cos(leafAngle) * leafR,
                    pos[1] + 0.1 + (ai % 2) * 0.15,
                    pos[2] + Math.sin(leafAngle) * leafR,
                  ]}
                  status={agent.status}
                />
              );
            })}
          </group>
        );
      })}

      {/* Rising particles = event activity */}
      <Particles count={30} activity={data.recentActivity} />

      {/* Root label */}
      <Text position={[0, -3.5, 0]} fontSize={0.2} color="#6b7280" anchorX="center">
        Yggdrasil
      </Text>

      <OrbitControls
        enablePan={false}
        minDistance={3}
        maxDistance={12}
        autoRotate
        autoRotateSpeed={0.3}
      />
    </>
  );
}

export default function YggdrasilForge() {
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Yggdrasil Forge</h2>
      <div className="rounded-lg overflow-hidden" style={{ height: 480 }}>
        <Canvas
          camera={{ position: [4, 3, 6], fov: 50 }}
          style={{ background: "linear-gradient(180deg, #0f0a1a 0%, #1a1025 50%, #0d1117 100%)" }}
        >
          <TreeScene />
        </Canvas>
      </div>
    </div>
  );
}
