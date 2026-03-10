import OrbitalStatusRings from "../components/OrbitalStatusRings";
import DockerPanel from "../components/DockerPanel";
import SupabasePanel from "../components/SupabasePanel";
import SystemResources from "../components/SystemResources";
import IntegrationHealth from "../components/IntegrationHealth";
import GithubActionsPanel from "../components/GithubActionsPanel";
import CompactionTimeline from "../components/CompactionTimeline";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import { useSystemResources } from "../hooks/useSystemResources";

export default function Infrastructure() {
  const resourceData = useSystemResources();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Infrastructure</h1>
      <OrbitalStatusRings />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DockerPanel />
        <SupabasePanel />
      </div>
      <SystemResources data={resourceData} />
      <IntegrationHealth />
      <SectionErrorBoundary name="GitHub Actions">
        <GithubActionsPanel />
      </SectionErrorBoundary>
      <SectionErrorBoundary name="Compaction Timeline">
        <CompactionTimeline />
      </SectionErrorBoundary>
    </div>
  );
}
