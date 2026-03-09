import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Float } from "@react-three/drei";
import * as THREE from "three";
import { useReactor } from "../hooks/useForge";
import { formatCost } from "../lib/formatters";

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#a78bfa",
  openai: "#34d399",
  google: "#60a5fa",
  ollama: "#f97316",
};

function Core({ pressure }: { pressure: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const coreColor = pressure > 80 ? "#ef4444" : pressure > 50 ? "#fbbf24" : "#6366f1";
  const intensity = 0.3 + (pressure / 100) * 0.7;

  useFrame((state) => {
    if (meshRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.05 * (pressure / 50);
      meshRef.current.scale.setScalar(scale);
    }
    if (glowRef.current) {
      const scale = 1.3 + Math.sin(state.clock.elapsedTime * 1.5) * 0.1;
      glowRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={coreColor}
          emissiveIntensity={intensity}
          roughness={0.2}
          metalness={0.3}
        />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshStandardMaterial
          color={coreColor}
          transparent
          opacity={0.1}
          emissive={coreColor}
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  );
}

function TokenRing({
  radius,
  color,
  speed,
  tokens,
  label,
}: {
  radius: number;
  color: string;
  speed: number;
  tokens: number;
  label: string;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * speed;
    }
  });

  const ringPoints = useMemo(() => {
    const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, 2 * Math.PI, false, 0);
    return curve.getPoints(64);
  }, [radius]);

  const ringGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      ringPoints.map((p) => new THREE.Vector3(p.x, 0, p.y))
    );
    return geometry;
  }, [ringPoints]);

  // Token count determines number of particles on the ring
  const particleCount = Math.min(Math.ceil(tokens / 5000), 20);

  return (
    <group ref={groupRef}>
      <lineLoop geometry={ringGeometry}>
        <lineBasicMaterial color={color} transparent opacity={0.3} />
      </lineLoop>
      {Array.from({ length: particleCount }).map((_, i) => {
        const angle = (i / particleCount) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * radius,
              (Math.random() - 0.5) * 0.15,
              Math.sin(angle) * radius,
            ]}
          >
            <sphereGeometry args={[0.04, 6, 6]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.6}
            />
          </mesh>
        );
      })}
      <Text
        position={[radius + 0.3, 0.3, 0]}
        fontSize={0.1}
        color="#6b7280"
        anchorX="left"
      >
        {label}
      </Text>
    </group>
  );
}

function ProviderOrbs({
  providers,
}: {
  providers: Record<string, { tokens: number; calls: number }>;
}) {
  const entries = Object.entries(providers);

  return (
    <>
      {entries.map(([provider, data], i) => {
        const angle = (i / Math.max(entries.length, 1)) * Math.PI * 2;
        const r = 3;
        const color = PROVIDER_COLORS[provider.toLowerCase()] ?? "#6b7280";
        const size = 0.1 + Math.min(data.calls * 0.02, 0.2);

        return (
          <Float key={provider} speed={2} floatIntensity={0.2}>
            <group position={[Math.cos(angle) * r, 0.5, Math.sin(angle) * r]}>
              <mesh>
                <sphereGeometry args={[size, 12, 12]} />
                <meshStandardMaterial
                  color={color}
                  emissive={color}
                  emissiveIntensity={0.5}
                  roughness={0.3}
                />
              </mesh>
              <Text
                position={[0, size + 0.12, 0]}
                fontSize={0.09}
                color="#9ca3af"
                anchorX="center"
              >
                {provider}
              </Text>
            </group>
          </Float>
        );
      })}
    </>
  );
}

function ReactorScene() {
  const data = useReactor();

  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 4, 0]} intensity={0.8} color="#6366f1" />
      <pointLight position={[3, 0, 3]} intensity={0.4} color="#a78bfa" />
      <pointLight position={[-3, 0, -3]} intensity={0.4} color="#22d3ee" />

      {/* Core = context pressure */}
      <Core pressure={data.contextPressure} />

      {/* Prompt token ring */}
      <TokenRing
        radius={1.2}
        color="#f59e0b"
        speed={0.4}
        tokens={data.totalPromptTokens}
        label={`Prompt: ${(data.totalPromptTokens / 1000).toFixed(0)}k`}
      />

      {/* Completion token ring */}
      <TokenRing
        radius={1.8}
        color="#22d3ee"
        speed={-0.3}
        tokens={data.totalCompletionTokens}
        label={`Completion: ${(data.totalCompletionTokens / 1000).toFixed(0)}k`}
      />

      {/* Provider orbs */}
      <ProviderOrbs providers={data.byProvider} />

      {/* Center label */}
      <Text position={[0, -1, 0]} fontSize={0.12} color="#9ca3af" anchorX="center">
        {`${data.callsLast10Min} calls / 10min`}
      </Text>

      <OrbitControls
        enablePan={false}
        minDistance={3}
        maxDistance={10}
        autoRotate
        autoRotateSpeed={0.2}
        maxPolarAngle={Math.PI * 0.65}
        minPolarAngle={Math.PI * 0.35}
      />
    </>
  );
}

export default function ContextReactor() {
  const data = useReactor();

  const pressureLabel =
    data.contextPressure > 80
      ? "CRITICAL"
      : data.contextPressure > 50
        ? "ELEVATED"
        : "NOMINAL";
  const pressureColor =
    data.contextPressure > 80
      ? "text-red-400"
      : data.contextPressure > 50
        ? "text-yellow-400"
        : "text-green-400";

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300">Context Reactor</h2>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-medium ${pressureColor}`}>
            {pressureLabel} — {data.contextPressure.toFixed(0)}%
          </span>
          <span className="text-[10px] text-gray-500">
            {formatCost(data.totalCost)}
          </span>
        </div>
      </div>
      <div className="rounded-lg overflow-hidden" style={{ height: 400 }}>
        <Canvas
          camera={{ position: [3, 2, 4], fov: 50 }}
          style={{ background: "radial-gradient(ellipse at center, #0a0a1f 0%, #050510 100%)" }}
        >
          <ReactorScene />
        </Canvas>
      </div>
      {/* Provider legend */}
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        <span className="text-[9px] text-gray-500 uppercase">Providers:</span>
        {Object.entries(data.byProvider).map(([provider, info]) => (
          <span key={provider} className="flex items-center gap-1 text-[9px] text-gray-400">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: PROVIDER_COLORS[provider.toLowerCase()] ?? "#6b7280" }}
            />
            {provider} ({info.calls})
          </span>
        ))}
        {Object.keys(data.byProvider).length === 0 && (
          <span className="text-[9px] text-gray-500">No activity</span>
        )}
      </div>
    </div>
  );
}
