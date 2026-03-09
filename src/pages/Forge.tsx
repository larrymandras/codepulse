import YggdrasilForge from "../components/YggdrasilForge";
import MemoryConstellation from "../components/MemoryConstellation";
import ContextReactor from "../components/ContextReactor";

export default function Forge() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Forge</h1>
        <p className="text-xs text-gray-500 mt-1">Immersive 3D system visualizations</p>
      </div>

      {/* Yggdrasil — full width */}
      <YggdrasilForge />

      {/* Constellation + Reactor — side by side on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MemoryConstellation />
        <ContextReactor />
      </div>
    </div>
  );
}
