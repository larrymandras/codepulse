import { useCallback } from "react";
import { usePrivacy } from "../contexts/PrivacyContext";
import { maskPath, maskSensitive, maskApiKey, maskEmail, maskIp, maskContactHandle } from "../lib/privacy";

/** Convenience hook — returns masking functions that respect current privacy settings */
export function usePrivacyMask() {
  const { enabled, maskPaths, maskEmails, maskKeys, maskIps, level } = usePrivacy();

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

  /** Mask a contact handle (a `messageRoutes.sender`: Telegram id, WhatsApp
   * `<digits>@lid`, E.164 number).
   *
   * Gated on `enabled` OR any non-`off` level — NOT on `enabled` alone.
   * `enabled` and `level` are independent pieces of state: `setLevel`
   * (PrivacyContext.tsx:59-66) writes only `level` and never touches
   * `enabled`, so a user who picks Screenshot from the default off state still
   * has `enabled === false`. Gating on `enabled` alone would render raw phone
   * numbers in the one view whose entire purpose is being safe to screenshot,
   * and blur-with-hover-to-reveal in demo mode puts the raw value one hover
   * away from an audience.
   *
   * Note the sibling helpers above (`mask`, `maskText`, `redact`) still gate on
   * `enabled` alone and therefore have the same gap for the data THEY cover.
   * That is pre-existing behaviour across many call sites and is deliberately
   * not changed here. */
  const maskHandle = useCallback(
    (handle: string) => maskContactHandle(handle, enabled || level !== "off"),
    [enabled, level]
  );

  return { enabled, mask, maskFilePath, maskText, redact, maskHandle };
}
