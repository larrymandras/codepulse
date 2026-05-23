import { useState, useCallback, useEffect } from "react";
import { useMutation } from "convex/react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Database } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { useProviderConfig } from "../hooks/useProviderConfig";
import { useCommandDispatch } from "../hooks/useCommandDispatch";
import {
  GATEWAY_PROVIDERS,
  PROVIDER_DISPLAY_NAMES,
  PROVIDER_BILLING,
  PROVIDER_COLORS,
} from "../lib/providers";
import { Badge } from "./ui/badge";

// ---------------------------------------------------------------------------
// SortableProvider subcomponent
// ---------------------------------------------------------------------------

interface SortableProviderProps {
  provider: string;
  enabled: boolean;
  loading: boolean;
  onToggle: (provider: string, enabled: boolean) => void;
}

function SortableProvider({
  provider,
  enabled,
  loading,
  onToggle,
}: SortableProviderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: provider });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const billing =
    PROVIDER_BILLING[provider as keyof typeof PROVIDER_BILLING] ?? "api";
  const color = PROVIDER_COLORS[provider] ?? "#6b7280";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 border border-border/50 bg-card/60 p-2.5 transition-colors group min-h-[44px] ${
        !enabled ? "opacity-50" : "hover:border-primary/50"
      }`}
    >
      <button
        className="cursor-grab text-muted-foreground/50 hover:text-primary transition-colors"
        aria-label={`Drag to reorder ${PROVIDER_DISPLAY_NAMES[provider] ?? provider}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span
        className={`text-sm flex-1 ${
          !enabled
            ? "line-through text-muted-foreground"
            : "text-foreground"
        }`}
      >
        {PROVIDER_DISPLAY_NAMES[provider] ?? provider}
      </span>
      <Badge
        variant="outline"
        className={`text-[10px] font-mono uppercase px-1.5 py-0.5 ${
          billing === "api"
            ? "bg-yellow-500/20 text-yellow-400"
            : "bg-gray-700/50 text-gray-400"
        }`}
      >
        {billing}
      </Badge>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <button
          onClick={() => onToggle(provider, !enabled)}
          className="flex items-center justify-between py-1 group/toggle"
          aria-label={
            enabled
              ? `Disable ${PROVIDER_DISPLAY_NAMES[provider] ?? provider}`
              : `Enable ${PROVIDER_DISPLAY_NAMES[provider] ?? provider}`
          }
        >
          <div
            className={`w-9 h-5 rounded-full transition-colors relative ${
              enabled ? "bg-indigo-600" : "bg-gray-700"
            }`}
          >
            <div
              className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                enabled ? "translate-x-[18px]" : "translate-x-[3px]"
              }`}
            />
          </div>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProviderControls
// ---------------------------------------------------------------------------

export default function ProviderControls() {
  const { configs, setEnabled, setPriority } = useProviderConfig();
  const { dispatch, isConnected } = useCommandDispatch();
  const runSeed = useMutation(api.seedGateway.runSeed);

  const [orderedProviders, setOrderedProviders] = useState<string[]>([
    ...GATEWAY_PROVIDERS,
  ]);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Sync orderedProviders from Convex configs (sorted by priority)
  useEffect(() => {
    if (configs.length > 0) {
      const sorted = [...configs].sort((a, b) => a.priority - b.priority);
      setOrderedProviders(sorted.map((c) => c.provider));
    }
  }, [configs]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleSeed = useCallback(async () => {
    setSeeding(true);
    try {
      await runSeed({});
      toast.success(
        "Gateway defaults seeded — alert rule and agent profiles created"
      );
    } catch {
      toast.error("Failed to seed gateway defaults. Try again.");
    } finally {
      setSeeding(false);
    }
  }, [runSeed]);

  const handleToggle = useCallback(
    async (provider: string, enabled: boolean) => {
      setLoadingProvider(provider);
      try {
        // Always persist to Convex first (restart recovery per D-07)
        await setEnabled({ provider, enabled });
        // Then send gateway command if connected (D-04)
        if (isConnected) {
          await dispatch(
            { type: "gateway.provider.set_enabled", provider, enabled },
            enabled
              ? `${PROVIDER_DISPLAY_NAMES[provider] ?? provider} enabled`
              : `${PROVIDER_DISPLAY_NAMES[provider] ?? provider} disabled`
          );
        } else {
          toast.warning(
            "Gateway offline -- setting saved, will apply on reconnect"
          );
        }
      } catch {
        toast.error(
          `Failed to update ${PROVIDER_DISPLAY_NAMES[provider] ?? provider}. Try again.`
        );
      } finally {
        setLoadingProvider(null);
      }
    },
    [setEnabled, dispatch, isConnected]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = orderedProviders.indexOf(String(active.id));
      const newIndex = orderedProviders.indexOf(String(over.id));
      // Filter to only providers with existing config rows to avoid ghost-creating rows
      const knownProviders = configs.map((c) => c.provider);
      const reordered = arrayMove(orderedProviders, oldIndex, newIndex).filter(
        (p) => knownProviders.includes(p)
      );
      setOrderedProviders(reordered);
      setPriority({ providers: reordered });
    },
    [orderedProviders, configs, setPriority]
  );

  return (
    <div>
      <h2 className="text-xs font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
        Gateway Providers
      </h2>
      {configs.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground mb-3">
            No gateway provider configuration found.
          </p>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-primary/50 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            {seeding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Database className="h-4 w-4" />
            )}
            Seed Gateway Defaults
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={orderedProviders}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {orderedProviders.map((provider) => {
                const config = configs.find((c) => c.provider === provider);
                return (
                  <SortableProvider
                    key={provider}
                    provider={provider}
                    enabled={config?.enabled ?? true}
                    loading={loadingProvider === provider}
                    onToggle={handleToggle}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
