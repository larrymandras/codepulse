import { useCallback } from "react";
import { usePrivacy } from "../contexts/PrivacyContext";
import { maskPath, maskSensitive, maskApiKey, maskEmail, maskIp } from "../lib/privacy";

/** Convenience hook — returns masking functions that respect current privacy settings */
export function usePrivacyMask() {
  const { enabled, maskPaths, maskEmails, maskKeys, maskIps } = usePrivacy();

  const mp = useCallback(
    (path: string) => (enabled && maskPaths ? maskPath(path) : path),
    [enabled, maskPaths]
  );

  const mt = useCallback(
    (text: string) => {
      if (!enabled) return text;
      let result = text;
      if (maskEmails) result = result.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (m) => maskEmail(m));
      if (maskKeys) result = result.replace(/\b(sk|pk|key|token|secret|api)[_-]?[a-zA-Z0-9]{8,}\b/gi, (m) => maskApiKey(m));
      if (maskIps) result = result.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, (m) => maskIp(m));
      return result;
    },
    [enabled, maskEmails, maskKeys, maskIps]
  );

  /** Mask arbitrary text with all enabled rules */
  const mask = useCallback(
    (text: string) => (enabled ? maskSensitive(text) : text),
    [enabled]
  );

  /** Mask a file path */
  const maskFilePath = mp;

  /** Mask text (selective by settings) */
  const maskText = mt;

  /** Redact to fixed string when privacy is on */
  const redact = useCallback(
    (text: string, placeholder = "••••••") => (enabled ? placeholder : text),
    [enabled]
  );

  return { enabled, mask, maskFilePath, maskText, redact };
}
