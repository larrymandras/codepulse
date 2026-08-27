import { useCallback } from "react";
import { usePrivacy } from "../contexts/PrivacyContext";
import { maskPath, maskSensitive, maskApiKey, maskEmail, maskIp, maskContactHandle } from "../lib/privacy";

/**
 * Convenience hook — returns masking functions that respect current privacy
 * settings.
 *
 * THE GATE IS `enabled` OR A NON-`off` LEVEL, never `enabled` alone.
 *
 * PrivacyContext carries two INDEPENDENT pieces of state, and `setLevel`
 * (`src/contexts/PrivacyContext.tsx:59-66`) writes only `level` — it never
 * touches `enabled`. So a user who picks Demo or Screenshot from the default
 * off state still has `enabled === false`. Every helper here previously gated
 * on `enabled` alone, which made screenshot mode redact NOTHING: its CSS half
 * (`.privacy-screenshot [data-sensitive]`, index.css:659) selects an attribute
 * that had no consumers, and its JS half never fired. Both halves of the
 * mechanism were inert.
 *
 * `masking` widens WHEN masking applies. It deliberately does NOT override
 * WHICH rules apply — the per-setting toggles (`maskPaths`, `maskEmails`,
 * `maskKeys`, `maskIps`) still gate their own rule, so an operator who turned
 * one off keeps it off at every level. Guarded by `usePrivacyMask.test.tsx`.
 */
export function usePrivacyMask() {
  const { enabled, maskPaths, maskEmails, maskKeys, maskIps, level } = usePrivacy();

  /** True whenever the operator has asked for ANY privacy treatment: the
   * explicit toggle, or a demo/screenshot level. */
  const masking = enabled || level !== "off";

  const mp = useCallback(
    (path: string) => (masking && maskPaths ? maskPath(path) : path),
    [masking, maskPaths]
  );

  const mt = useCallback(
    (text: string) => {
      if (!masking) return text;
      let result = text;
      if (maskEmails) result = result.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (m) => maskEmail(m));
      if (maskKeys) result = result.replace(/\b(sk|pk|key|token|secret|api)[_-]?[a-zA-Z0-9]{8,}\b/gi, (m) => maskApiKey(m));
      if (maskIps) result = result.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, (m) => maskIp(m));
      return result;
    },
    [masking, maskEmails, maskKeys, maskIps]
  );

  /** Mask arbitrary text with all enabled rules */
  const mask = useCallback(
    (text: string) => (masking ? maskSensitive(text) : text),
    [masking]
  );

  /** Mask a file path */
  const maskFilePath = mp;

  /** Mask text (selective by settings) */
  const maskText = mt;

  /** Redact to fixed string when privacy is on */
  const redact = useCallback(
    (text: string, placeholder = "••••••") => (masking ? placeholder : text),
    [masking]
  );

  /** Mask a contact handle (a `messageRoutes.sender`: Telegram id, WhatsApp
   * `<digits>@lid`, E.164 number). Blur-with-hover-to-reveal in demo mode puts
   * an unmasked value one hover away from an audience, which is why this is
   * masked at demo level too rather than left to the CSS. */
  const maskHandle = useCallback(
    (handle: string) => maskContactHandle(handle, masking),
    [masking]
  );

  /** The resolved gate, exposed so a component can mark an element
   * `data-sensitive` and skip rendering a value entirely when it cannot be
   * meaningfully masked. `enabled` remains the raw toggle. */
  return { enabled, masking, mask, maskFilePath, maskText, redact, maskHandle };
}
