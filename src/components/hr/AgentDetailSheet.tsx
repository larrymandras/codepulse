import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import AgentAvatar from "@/components/AgentAvatar";
import AvatarUploader from "@/components/AvatarUploader";
import { StatusBadge } from "@/components/StatusBadge";
import { useAgentProfiles } from "@/hooks/useAgentProfiles";
import { useAvatars, useAvatarMutations } from "@/hooks/useAvatars";
import { fetchAgentDetail, deleteAgent, cloneAgent, type AgentDetail } from "@/lib/astridrApi";
import { DetailConfigTab } from "@/components/hr/detail/DetailConfigTab";
import { DetailRuntimeTab } from "@/components/hr/detail/DetailRuntimeTab";
import { DetailTopologyTab } from "@/components/hr/detail/DetailTopologyTab";
import { DetailSecurityTab } from "@/components/hr/detail/DetailSecurityTab";
import { DetailActivityTab } from "@/components/hr/detail/DetailActivityTab";
import { DetailVersionsTab } from "@/components/hr/detail/DetailVersionsTab";
import { Maximize2, Trash2, Loader2, RefreshCw, Copy, Camera } from "lucide-react";
import { toast } from "sonner";

interface AgentDetailSheetProps {
  agentId: string | null;
  onClose: () => void;
  onDeregister: (agentId: string) => void;
}

const TIER_BADGE_COLOR: Record<string, string> = {
  command: "bg-purple-600 text-white",
  domain: "bg-blue-600 text-white",
  shared: "bg-gray-600 text-white",
};

export function AgentDetailSheet({
  agentId,
  onClose,
  onDeregister,
}: AgentDetailSheetProps) {
  const navigate = useNavigate();
  const [agentDetail, setAgentDetail] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeregister, setShowDeregister] = useState(false);
  const [deregistering, setDeregistering] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [showAvatarUpload, setShowAvatarUpload] = useState(false);

  const profiles = useAgentProfiles();
  const avatars = useAvatars();
  const { saveImage } = useAvatarMutations();

  useEffect(() => {
    if (!agentId) {
      setAgentDetail(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetchAgentDetail(agentId)
      .then((data) => setAgentDetail(data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load agent"),
      )
      .finally(() => setLoading(false));
  }, [agentId]);

  const handleExpand = () => {
    if (agentId) {
      navigate(`/hr/roster/${agentId}`);
    }
  };

  const handleClone = async () => {
    if (!agentId) return;
    setCloning(true);
    try {
      const result = await cloneAgent(agentId);
      toast.success("Agent cloned");
      navigate(`/hr/onboarding?clone=${result.id}`);
    } catch {
      toast.error("Failed to clone agent");
    } finally {
      setCloning(false);
    }
  };

  const handleDeregister = async () => {
    if (!agentId) return;
    setDeregistering(true);
    try {
      await deleteAgent(agentId);
      toast.success("Agent deregistered");
      setShowDeregister(false);
      onDeregister(agentId);
    } catch {
      toast.error("Failed to deregister agent");
    } finally {
      setDeregistering(false);
    }
  };

  const retry = () => {
    if (agentId) {
      setLoading(true);
      setError(null);
      fetchAgentDetail(agentId)
        .then((data) => setAgentDetail(data))
        .catch((err) =>
          setError(err instanceof Error ? err.message : "Failed to load agent"),
        )
        .finally(() => setLoading(false));
    }
  };

  const avatarStatus = agentDetail
    ? agentDetail.active
      ? "active"
      : "idle"
    : "idle";

  const matchedProfile = profiles.find(
    (p) => p.profileId === agentDetail?.id || p.name === agentDetail?.name,
  );
  const matchedAvatar = matchedProfile?.avatarId
    ? avatars.find((a) => a._id === matchedProfile.avatarId)
    : undefined;

  const handleAvatarUpload = async (storageId: string) => {
    if (matchedAvatar) {
      await saveImage({
        id: matchedAvatar._id,
        storageId: storageId as any,
      });
      toast.success("Avatar updated");
    }
    setShowAvatarUpload(false);
  };

  return (
    <>
      <Sheet open={!!agentId} onOpenChange={(open) => { if (!open) { onClose(); setShowAvatarUpload(false); } }}>
        <SheetContent
          side="right"
          className="w-[480px] sm:max-w-[480px] overflow-y-auto"
        >
          {loading && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-[300px] w-full" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={retry}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && agentDetail && (
            <>
              <SheetHeader className="pb-4">
                <div className="flex items-start gap-3">
                  <div
                    className="relative group cursor-pointer"
                    onClick={() => setShowAvatarUpload(!showAvatarUpload)}
                    title="Click to change avatar"
                  >
                    <AgentAvatar
                      avatar={matchedAvatar ?? { name: agentDetail.name }}
                      status={avatarStatus as "active" | "idle"}
                      size="lg"
                    />
                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-xl font-semibold text-foreground truncate">
                      {agentDetail.name}
                    </SheetTitle>
                    <SheetDescription className="text-sm text-muted-foreground truncate">
                      {agentDetail.description || agentDetail.id}
                    </SheetDescription>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${TIER_BADGE_COLOR[agentDetail.tier] ?? TIER_BADGE_COLOR.shared}`}
                      >
                        {agentDetail.tier}
                      </Badge>
                      <StatusBadge
                        status={agentDetail.active ? "active" : "idle"}
                      />
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={handleExpand}
                  >
                    <Maximize2 className="h-3.5 w-3.5 mr-1" />
                    Expand
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={handleClone}
                    disabled={cloning}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    {cloning ? "Cloning..." : "Clone"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="text-xs"
                    onClick={() => setShowDeregister(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Deregister
                  </Button>
                </div>
                {showAvatarUpload && (
                  <div className="border border-border rounded-lg p-3 mt-3">
                    <AvatarUploader
                      onUpload={handleAvatarUpload}
                      onCancel={() => setShowAvatarUpload(false)}
                    />
                  </div>
                )}
              </SheetHeader>

              {/* Tabs */}
              <Tabs defaultValue="config" className="mt-2">
                <TabsList className="w-full">
                  <TabsTrigger value="config" className="text-xs flex-1">
                    Config
                  </TabsTrigger>
                  <TabsTrigger value="runtime" className="text-xs flex-1">
                    Runtime
                  </TabsTrigger>
                  <TabsTrigger value="topology" className="text-xs flex-1">
                    Topology
                  </TabsTrigger>
                  <TabsTrigger value="security" className="text-xs flex-1">
                    Security
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="text-xs flex-1">
                    Activity
                  </TabsTrigger>
                  <TabsTrigger value="versions" className="text-xs flex-1">
                    Versions
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="config" className="mt-4">
                  <DetailConfigTab
                    agentId={agentDetail.id}
                    agentDetail={agentDetail}
                  />
                </TabsContent>
                <TabsContent value="runtime" className="mt-4">
                  <DetailRuntimeTab
                    agentId={agentDetail.id}
                    agentDetail={agentDetail}
                  />
                </TabsContent>
                <TabsContent value="topology" className="mt-4">
                  <DetailTopologyTab agentId={agentDetail.id} />
                </TabsContent>
                <TabsContent value="security" className="mt-4">
                  <DetailSecurityTab
                    agentId={agentDetail.id}
                    agentDetail={agentDetail}
                  />
                </TabsContent>
                <TabsContent value="activity" className="mt-4">
                  <DetailActivityTab agentId={agentDetail.id} />
                </TabsContent>
                <TabsContent value="versions" className="mt-4">
                  <DetailVersionsTab agentId={agentDetail.id} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Deregister confirmation dialog */}
      <Dialog open={showDeregister} onOpenChange={setShowDeregister}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deregister {agentDetail?.name}?</DialogTitle>
            <DialogDescription>
              This will permanently remove {agentDetail?.name} from the agent
              registry. Active sessions will be terminated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeregister(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeregister}
              disabled={deregistering}
            >
              {deregistering && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              Deregister
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AgentDetailSheet;
