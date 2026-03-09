import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import SoundEngine, {
  type SystemHealth,
  type Category,
  type PresetName,
  type AlertType,
  type EventType,
  type TransitionType,
} from "../lib/audioEngine";

// Re-export types so consumers can import from context
export type { SystemHealth, Category, PresetName, AlertType, EventType, TransitionType };

interface AmbientContextValue {
  enabled: boolean;
  volume: number;
  preset: PresetName;
  categoryVolumes: Record<Category, number>;
  toggle: () => void;
  setVolume: (v: number) => void;
  setPreset: (name: PresetName) => void;
  setCategoryVolume: (cat: Category, v: number) => void;
  setHealth: (h: SystemHealth) => void;
  playAlert: (type: AlertType) => void;
  playEvent: (type: EventType) => void;
  playTransition: (type: TransitionType) => void;
}

const STORAGE_KEY = "codepulse-ambient";

const DEFAULT_CATEGORY_VOLUMES: Record<Category, number> = {
  alerts: 0.8,
  ambience: 0.3,
  events: 0.2,
  transitions: 0.3,
};

interface StoredPrefs {
  enabled: boolean;
  volume: number;
  preset: PresetName;
  categoryVolumes: Record<Category, number>;
}

function loadPrefs(): StoredPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: parsed.enabled ?? false,
        volume: parsed.volume ?? 0.08,
        preset: parsed.preset ?? "forge",
        categoryVolumes: {
          ...DEFAULT_CATEGORY_VOLUMES,
          ...(parsed.categoryVolumes ?? {}),
        },
      };
    }
  } catch {
    /* ignore */
  }
  return {
    enabled: false,
    volume: 0.08,
    preset: "forge",
    categoryVolumes: { ...DEFAULT_CATEGORY_VOLUMES },
  };
}

function savePrefs(prefs: StoredPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

const AmbientCtx = createContext<AmbientContextValue | null>(null);

export function AmbientProvider({ children }: { children: ReactNode }) {
  const engineRef = useRef<SoundEngine>(new SoundEngine());
  const [enabled, setEnabled] = useState(() => loadPrefs().enabled);
  const [volume, setVolumeState] = useState(() => loadPrefs().volume);
  const [preset, setPresetState] = useState<PresetName>(
    () => loadPrefs().preset,
  );
  const [categoryVolumes, setCategoryVolumesState] = useState<
    Record<Category, number>
  >(() => loadPrefs().categoryVolumes);

  // Refs to track current values for use in save operations
  const enabledRef = useRef(enabled);
  const volumeRef = useRef(volume);
  const presetRef = useRef(preset);
  const categoryVolumesRef = useRef(categoryVolumes);

  // Keep refs in sync with state
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { presetRef.current = preset; }, [preset]);
  useEffect(() => { categoryVolumesRef.current = categoryVolumes; }, [categoryVolumes]);

  // Sync engine state on mount / enabled change
  useEffect(() => {
    const engine = engineRef.current;
    if (enabled && !engine.running) {
      // start() is async (Tone.start requires user gesture context)
      engine.setAmbientPreset(presetRef.current);
      engine
        .start()
        .then(() => {
          engine.setMasterVolume(volumeRef.current);
          // Apply stored category volumes
          for (const [cat, vol] of Object.entries(categoryVolumesRef.current)) {
            engine.setCategoryVolume(cat as Category, vol);
          }
        })
        .catch(() => {
          // AudioContext may fail if no user gesture yet
        });
    } else if (!enabled && engine.running) {
      engine.stop();
    }
    return () => {
      if (engine.running) engine.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      savePrefs({
        enabled: next,
        volume: volumeRef.current,
        preset: presetRef.current,
        categoryVolumes: categoryVolumesRef.current,
      });
      return next;
    });
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    engineRef.current.setMasterVolume(v);
    savePrefs({
      enabled: enabledRef.current,
      volume: v,
      preset: presetRef.current,
      categoryVolumes: categoryVolumesRef.current,
    });
  }, []);

  const setPreset = useCallback((name: PresetName) => {
    setPresetState(name);
    engineRef.current.setAmbientPreset(name);
    savePrefs({
      enabled: enabledRef.current,
      volume: volumeRef.current,
      preset: name,
      categoryVolumes: categoryVolumesRef.current,
    });
  }, []);

  const setCategoryVolume = useCallback((cat: Category, v: number) => {
    setCategoryVolumesState((prev) => {
      const next = { ...prev, [cat]: v };
      engineRef.current.setCategoryVolume(cat, v);
      savePrefs({
        enabled: enabledRef.current,
        volume: volumeRef.current,
        preset: presetRef.current,
        categoryVolumes: next,
      });
      return next;
    });
  }, []);

  const setHealth = useCallback((h: SystemHealth) => {
    engineRef.current.setHealth(h);
  }, []);

  const playAlert = useCallback((type: AlertType) => {
    engineRef.current.playAlert(type);
  }, []);

  const playEvent = useCallback((type: EventType) => {
    engineRef.current.playEvent(type);
  }, []);

  const playTransition = useCallback((type: TransitionType) => {
    engineRef.current.playTransition(type);
  }, []);

  return (
    <AmbientCtx.Provider
      value={{
        enabled,
        volume,
        preset,
        categoryVolumes,
        toggle,
        setVolume,
        setPreset,
        setCategoryVolume,
        setHealth,
        playAlert,
        playEvent,
        playTransition,
      }}
    >
      {children}
    </AmbientCtx.Provider>
  );
}

export function useAmbient(): AmbientContextValue {
  const ctx = useContext(AmbientCtx);
  if (!ctx) throw new Error("useAmbient must be used within AmbientProvider");
  return ctx;
}
