import { useRef, useState, useCallback, useEffect } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import { useProviderGlobe, type GlobePoint } from "../hooks/useProviderGlobe";
import { PROVIDER_LOCATIONS } from "../lib/providerLocations";
import { formatCost } from "../lib/formatters";

export default function ProviderGlobe() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 480 });
  const [selectedProvider, setSelectedProvider] = useState<GlobePoint | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  const { points, arcs, stats } = useProviderGlobe();

  // Measure container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({ width: entry.contentRect.width, height: 480 });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Configure auto-rotation via OrbitControls
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    // Wait a tick for controls to initialize
    const timer = setTimeout(() => {
      try {
        const controls = globe.controls();
        controls.autoRotate = autoRotate;
        controls.autoRotateSpeed = 0.3;
      } catch {
        // controls may not be ready yet
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [autoRotate]);

  // Set initial point of view
  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe.pointOfView({ lat: 30, lng: -50, altitude: 2.5 }, 1000);
    try {
      const controls = globe.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.3;
    } catch {
      // controls may not be ready
    }
  }, []);

  // Pause auto-rotation on user interaction, resume after delay
  const handleInteraction = useCallback(() => {
    setAutoRotate(false);
    const timer = setTimeout(() => setAutoRotate(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  const handlePointClick = useCallback(
    (point: object) => {
      const p = point as GlobePoint;
      setSelectedProvider((prev) => (prev?.provider === p.provider ? null : p));
      handleInteraction();
    },
    [handleInteraction],
  );

  const handleGlobeClick = useCallback(() => {
    setSelectedProvider(null);
  }, []);

  return (
    <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300">Provider Network</h2>
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <span>{stats.activeProviders} providers</span>
          <span>&middot;</span>
          <span>{formatCost(stats.totalCost)}</span>
          <span>&middot;</span>
          <span>{stats.avgLatency}ms avg</span>
        </div>
      </div>

      {/* Globe Container */}
      <div
        ref={containerRef}
        className="relative rounded-lg overflow-hidden"
        style={{ height: 480 }}
      >
        {dimensions.width > 0 && (
          <Globe
            ref={globeRef as React.MutableRefObject<GlobeMethods | undefined>}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="rgba(0,0,0,0)"
            showAtmosphere={true}
            atmosphereColor="#67E8F9"
            atmosphereAltitude={0.2}
            showGraticules={true}
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
            onGlobeReady={handleGlobeReady}
            onGlobeClick={handleGlobeClick}
            // Points layer — provider locations
            pointsData={points}
            pointLat="lat"
            pointLng="lng"
            pointColor="color"
            pointAltitude="altitude"
            pointRadius={0.5}
            pointLabel="label"
            onPointClick={handlePointClick}
            // Arcs layer — recent LLM calls
            arcsData={arcs}
            arcStartLat="startLat"
            arcStartLng="startLng"
            arcEndLat="endLat"
            arcEndLng="endLng"
            arcColor="color"
            arcStroke="stroke"
            arcAltitude="altitude"
            arcDashLength={0.5}
            arcDashGap={0.3}
            arcDashAnimateTime={2000}
            arcLabel="label"
          />
        )}

        {/* Provider Detail Popup */}
        {selectedProvider && (
          <div className="absolute top-4 right-4 bg-gray-900 border border-gray-600 rounded-lg p-3 text-xs z-10 min-w-[180px] shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span
                className="font-semibold text-gray-100 capitalize"
                style={{ color: selectedProvider.color }}
              >
                {selectedProvider.provider}
              </span>
              <button
                onClick={() => setSelectedProvider(null)}
                className="text-gray-500 hover:text-gray-300 text-sm leading-none"
              >
                x
              </button>
            </div>
            <div className="space-y-1 text-gray-400">
              <div className="flex justify-between">
                <span>Calls</span>
                <span className="text-gray-200">{selectedProvider.calls}</span>
              </div>
              <div className="flex justify-between">
                <span>Cost</span>
                <span className="text-gray-200">{formatCost(selectedProvider.cost)}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Latency</span>
                <span className="text-gray-200">{selectedProvider.avgLatency}ms</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Provider Legend + Stats */}
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {/* Provider legend */}
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-400">
          {Object.entries(PROVIDER_LOCATIONS).map(([name, loc]) => (
            <div key={name} className="flex items-center gap-1">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: loc.color }}
              />
              <span className="capitalize">{name}</span>
            </div>
          ))}
        </div>

        {/* Stats cards */}
        <div className="ml-auto flex items-center gap-3">
          <StatCard label="Tokens" value={stats.totalTokens.toLocaleString()} />
          <StatCard label="Cost" value={formatCost(stats.totalCost)} />
          <StatCard label="Latency" value={`${stats.avgLatency}ms`} />
          <StatCard label="Providers" value={String(stats.activeProviders)} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700/40 rounded-md px-2.5 py-1.5 text-center min-w-[64px]">
      <div className="text-[10px] text-gray-500">{label}</div>
      <div className="text-xs font-medium text-gray-200">{value}</div>
    </div>
  );
}
