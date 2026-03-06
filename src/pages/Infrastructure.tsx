import DockerPanel from "../components/DockerPanel";
import SupabasePanel from "../components/SupabasePanel";
import SystemResources from "../components/SystemResources";
import IntegrationHealth from "../components/IntegrationHealth";

export default function Infrastructure() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Infrastructure</h1>
      <DockerPanel />
      <SupabasePanel />
      <SystemResources />
      <IntegrationHealth />
    </div>
  );
}
