import OrbitalStatusRings from "../components/OrbitalStatusRings";
import DockerPanel from "../components/DockerPanel";
import SupabasePanel from "../components/SupabasePanel";
import SystemResources from "../components/SystemResources";
import IntegrationHealth from "../components/IntegrationHealth";

export default function Infrastructure() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Infrastructure</h1>
      <OrbitalStatusRings />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DockerPanel />
        <SupabasePanel />
      </div>
      <SystemResources />
      <IntegrationHealth />
    </div>
  );
}
