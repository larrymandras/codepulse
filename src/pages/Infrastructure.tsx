import { useState, useEffect } from "react";
import OrbitalStatusRings from "../components/OrbitalStatusRings";
import DockerPanel from "../components/DockerPanel";
import SupabasePanel from "../components/SupabasePanel";
import SystemResources from "../components/SystemResources";
import IntegrationHealth from "../components/IntegrationHealth";
import GithubActionsPanel from "../components/GithubActionsPanel";
import CompactionTimeline from "../components/CompactionTimeline";
import ChannelHealthPanel from "../components/ChannelHealthPanel";
import ProviderHealthPanel from "../components/ProviderHealthPanel";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import { useSystemResources } from "../hooks/useSystemResources";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { useLiveFlash } from "@/hooks/useLiveFlash";

type DockerStatusPayload = {
  container?: string;
  status?: string;
  [key: string]: unknown;
};

type McpConnectionPayload = {
  server?: string;
  connected?: boolean;
  [key: string]: unknown;
};

export default function Infrastructure() {
  const resourceData = useSystemResources();
  const { subscribeEvent } = useAstridrWS();
  const { flashRef, triggerFlash } = useLiveFlash();

  // Track latest WS-driven health status (transient overlay)
  const [_lastDockerStatus, setLastDockerStatus] = useState<DockerStatusPayload | null>(null);
  const [_lastMcpStatus, setLastMcpStatus] = useState<McpConnectionPayload | null>(null);

  useEffect(() => {
    const unsubDocker = subscribeEvent("docker_status", (event) => {
      const data = event.data as DockerStatusPayload | undefined;
      if (data) setLastDockerStatus(data);
      triggerFlash();
    });

    const unsubMcp = subscribeEvent("mcp_connection", (event) => {
      const data = event.data as McpConnectionPayload | undefined;
      if (data) setLastMcpStatus(data);
      triggerFlash();
    });

    return () => {
      unsubDocker();
      unsubMcp();
    };
  }, [subscribeEvent, triggerFlash]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Infrastructure</h1>
      <OrbitalStatusRings />
      <SectionErrorBoundary name="Infrastructure Health">
        <div ref={flashRef} className="space-y-6">
          <SectionErrorBoundary name="Channel Health">
            <ChannelHealthPanel />
          </SectionErrorBoundary>
          <SectionErrorBoundary name="Provider Health">
            <ProviderHealthPanel />
          </SectionErrorBoundary>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DockerPanel />
            <SupabasePanel />
          </div>
        </div>
      </SectionErrorBoundary>
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
