/** Privacy masking utilities — redact PII, secrets, and sensitive paths */

// Patterns for auto-detection
const API_KEY_RE = /\b(sk|pk|key|token|secret|api)[_-]?[a-zA-Z0-9]{8,}\b/gi;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const IPV4_RE = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
const ENV_VAR_RE = /\b[A-Z][A-Z0-9_]{3,}=[^\s]+/g;

export function maskPath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  if (parts.length <= 2) return path;
  // Keep first segment + filename, mask middle
  const first = parts[0] || "/";
  const last = parts[parts.length - 1];
  const masked = parts.slice(1, -1).map(() => "***");
  return [first, ...masked, last].join("/");
}

export function maskApiKey(key: string): string {
  if (key.length < 8) return "***";
  const prefix = key.slice(0, Math.min(4, key.indexOf("-") + 1 || 4));
  const suffix = key.slice(-4);
  return `${prefix}***${suffix}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***@***";
  return `${local[0]}***@${domain}`;
}

export function maskIp(ip: string): string {
  const parts = ip.split(".");
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.*.*`;
}

export function maskEnvValue(envLine: string): string {
  const eq = envLine.indexOf("=");
  if (eq < 0) return envLine;
  return envLine.slice(0, eq + 1) + "***";
}

/** Auto-detect and mask all sensitive patterns in a string */
export function maskSensitive(text: string): string {
  let result = text;
  result = result.replace(EMAIL_RE, (m) => maskEmail(m));
  result = result.replace(API_KEY_RE, (m) => maskApiKey(m));
  result = result.replace(IPV4_RE, (m) => maskIp(m));
  result = result.replace(ENV_VAR_RE, (m) => maskEnvValue(m));
  return result;
}

/** Mask a file path — only when privacy mode is on */
export function maskFilePath(path: string, enabled: boolean): string {
  return enabled ? maskPath(path) : path;
}

/** Mask arbitrary text — only when privacy mode is on */
export function maskText(text: string, enabled: boolean): string {
  return enabled ? maskSensitive(text) : text;
}
