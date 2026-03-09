import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { AmbientAudioEngine, type SystemHealth } from "../lib/audioEngine";

interface AmbientContextValue {
  enabled: boolean;
  volume: number;
  toggle: () => void;
  setVolume: (v: number) => void;
  setHealth: (h: SystemHealth) => void;
  pulse: (pitch?: number) => void;
  alertChime: () => void;
}

const STORAGE_KEY = "codepulse-ambient";

function loadPrefs(): { enabled: boolean; volume: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { enabled: false, volume: 0.08 };
}

function savePrefs(prefs: { enabled: boolean; volume: number }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

const AmbientCtx = createContext<AmbientContextValue | null>(null);

export function AmbientProvider({ children }: { children: ReactNode }) {
  const engineRef = useRef<AmbientAudioEngine>(new AmbientAudioEngine());
  const [enabled, setEnabled] = useState(() => loadPrefs().enabled);
  const [volume, setVolumeState] = useState(() => loadPrefs().volume);

  // Sync engine state on mount / enabled change
  useEffect(() => {
    const engine = engineRef.current;
    if (enabled && !engine.running) {
      engine.start();
      engine.setVolume(volume);
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
      savePrefs({ enabled: next, volume });
      return next;
    });
  }, [volume]);

  const setVolume = useCallback(
    (v: number) => {
      setVolumeState(v);
      engineRef.current.setVolume(v);
      savePrefs({ enabled, volume: v });
    },
    [enabled]
  );

  const setHealth = useCallback((h: SystemHealth) => {
    engineRef.current.setHealth(h);
  }, []);

  const pulse = useCallback((pitch?: number) => {
    engineRef.current.pulse(pitch);
  }, []);

  const alertChime = useCallback(() => {
    engineRef.current.alertChime();
  }, []);

  return (
    <AmbientCtx.Provider
      value={{ enabled, volume, toggle, setVolume, setHealth, pulse, alertChime }}
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
