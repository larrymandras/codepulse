import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface PrivacyState {
  enabled: boolean;
  maskPaths: boolean;
  maskEmails: boolean;
  maskKeys: boolean;
  maskIps: boolean;
}

interface PrivacyContextValue extends PrivacyState {
  toggle: () => void;
  setSetting: (key: keyof Omit<PrivacyState, "enabled">, value: boolean) => void;
}

const STORAGE_KEY = "codepulse-privacy";

function loadState(): PrivacyState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { enabled: false, maskPaths: true, maskEmails: true, maskKeys: true, maskIps: true };
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
    (key: keyof Omit<PrivacyState, "enabled">, value: boolean) => {
      setState((prev) => {
        const next = { ...prev, [key]: value };
        saveState(next);
        return next;
      });
    },
    []
  );

  return (
    <PrivacyContext.Provider value={{ ...state, toggle, setSetting }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error("usePrivacy must be used within PrivacyProvider");
  return ctx;
}
