import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

interface PrivacyState {
  enabled: boolean;
  maskPaths: boolean;
  maskEmails: boolean;
  maskKeys: boolean;
  maskIps: boolean;
  level: "off" | "demo" | "screenshot";
}

interface PrivacyContextValue extends PrivacyState {
  toggle: () => void;
  setSetting: (key: keyof Omit<PrivacyState, "enabled" | "level">, value: boolean) => void;
  setLevel: (level: "off" | "demo" | "screenshot") => void;
}

const STORAGE_KEY = "codepulse-privacy";

function loadState(): PrivacyState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { level: "off", ...parsed };
    }
  } catch {}
  return { enabled: false, maskPaths: true, maskEmails: true, maskKeys: true, maskIps: true, level: "off" };
}

function saveState(state: PrivacyState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PrivacyState>(loadState);

  const toggle = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, enabled: !prev.enabled };
      saveState(next);
      return next;
    });
  }, []);

  const setSetting = useCallback(
    (key: keyof Omit<PrivacyState, "enabled" | "level">, value: boolean) => {
      setState((prev) => {
        const next = { ...prev, [key]: value };
        saveState(next);
        return next;
      });
    },
    []
  );

  const setLevel = useCallback((level: "off" | "demo" | "screenshot") => {
    setState((prev) => {
      const next = { ...prev, level };
      saveState(next);
      return next;
    });
  }, []);

  // Apply CSS classes for privacy level
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("privacy-demo", "privacy-screenshot");
    if (state.level === "demo") root.classList.add("privacy-demo");
    else if (state.level === "screenshot") root.classList.add("privacy-screenshot");
  }, [state.level]);

  // Listen for keyboard shortcut cycle event
  useEffect(() => {
    const handler = () => {
      setState((prev) => {
        const levels: Array<"off" | "demo" | "screenshot"> = ["off", "demo", "screenshot"];
        const idx = levels.indexOf(prev.level);
        const next = { ...prev, level: levels[(idx + 1) % levels.length] };
        saveState(next);
        return next;
      });
    };
    window.addEventListener("codepulse-cycle-privacy", handler);
    return () => window.removeEventListener("codepulse-cycle-privacy", handler);
  }, []);

  return (
    <PrivacyContext.Provider value={{ ...state, toggle, setSetting, setLevel }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error("usePrivacy must be used within PrivacyProvider");
  return ctx;
}
