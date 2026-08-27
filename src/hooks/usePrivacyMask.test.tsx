/**
 * usePrivacyMask — the `enabled` vs `level` gate.
 *
 * PrivacyContext carries TWO independent pieces of state and `setLevel`
 * (`src/contexts/PrivacyContext.tsx:59-66`) writes ONLY `level` — it never
 * touches `enabled`. So a user who picks Demo or Screenshot from the default
 * off state still has `enabled === false`.
 *
 * Every helper here used to gate on `enabled` alone, which meant screenshot
 * mode redacted NOTHING: its CSS half (`.privacy-screenshot [data-sensitive]`,
 * index.css:659) selects an attribute that had no consumers, and its JS half
 * never fired. Both halves of the mechanism were inert.
 *
 * These tests drive the REAL PrivacyProvider by seeding its localStorage key,
 * so they exercise the same state a user reaches through the UI. A mocked
 * context could not catch a helper that ignored the flag entirely.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { PrivacyProvider } from "../contexts/PrivacyContext";
import { usePrivacyMask } from "./usePrivacyMask";

beforeEach(() => {
  localStorage.clear();
});

function seed(enabled: boolean, level: "off" | "demo" | "screenshot") {
  localStorage.setItem(
    "codepulse-privacy",
    JSON.stringify({
      enabled,
      maskPaths: true,
      maskEmails: true,
      maskKeys: true,
      maskIps: true,
      level,
    })
  );
}

function wrapper({ children }: { children: ReactNode }) {
  return <PrivacyProvider>{children}</PrivacyProvider>;
}

function maskAt(enabled: boolean, level: "off" | "demo" | "screenshot") {
  seed(enabled, level);
  return renderHook(() => usePrivacyMask(), { wrapper }).result.current;
}

const SECRET_TEXT = "contact me at alice@example.com from 10.0.0.44";
const SECRET_PATH = "/home/operator/projects/thing/src/index.ts";
const HANDLE = "5550101234";

describe("usePrivacyMask — level 'off' with privacy disabled shows raw (control)", () => {
  it("returns every value untouched", () => {
    const m = maskAt(false, "off");

    expect(m.enabled).toBe(false);
    expect(m.mask(SECRET_TEXT)).toBe(SECRET_TEXT);
    expect(m.maskText(SECRET_TEXT)).toBe(SECRET_TEXT);
    expect(m.maskFilePath(SECRET_PATH)).toBe(SECRET_PATH);
    expect(m.redact(HANDLE)).toBe(HANDLE);
    expect(m.maskHandle(HANDLE)).toBe(HANDLE);
  });
});

describe("usePrivacyMask — the explicit `enabled` toggle still works", () => {
  it("masks everything when enabled, even at level 'off'", () => {
    const m = maskAt(true, "off");

    expect(m.mask(SECRET_TEXT)).not.toContain("alice@example.com");
    expect(m.maskText(SECRET_TEXT)).not.toContain("alice@example.com");
    expect(m.maskFilePath(SECRET_PATH)).not.toBe(SECRET_PATH);
    expect(m.redact(HANDLE)).not.toBe(HANDLE);
    expect(m.maskHandle(HANDLE)).not.toBe(HANDLE);
  });
});

describe("usePrivacyMask — SCREENSHOT level masks even though `enabled` is false", () => {
  // The whole point: this is the state a user reaches by picking Screenshot
  // from the default. Before the fix every assertion below failed.
  it("masks free text", () => {
    const m = maskAt(false, "screenshot");
    const out = m.mask(SECRET_TEXT);
    expect(out).not.toContain("alice@example.com");
    expect(out).not.toContain("10.0.0.44");
  });

  it("masks selectively-masked text", () => {
    const m = maskAt(false, "screenshot");
    expect(m.maskText(SECRET_TEXT)).not.toContain("alice@example.com");
  });

  it("masks file paths", () => {
    const m = maskAt(false, "screenshot");
    expect(m.maskFilePath(SECRET_PATH)).not.toBe(SECRET_PATH);
  });

  it("redacts", () => {
    const m = maskAt(false, "screenshot");
    expect(m.redact(HANDLE)).not.toBe(HANDLE);
  });

  it("masks contact handles", () => {
    const m = maskAt(false, "screenshot");
    expect(m.maskHandle(HANDLE)).toBe("55***34");
  });
});

describe("usePrivacyMask — DEMO level masks even though `enabled` is false", () => {
  // Demo blurs `[data-sensitive]` with hover-to-reveal, so an unmasked value is
  // one hover away from an audience watching a demo.
  it("masks free text, paths, redactions and handles", () => {
    const m = maskAt(false, "demo");

    expect(m.mask(SECRET_TEXT)).not.toContain("alice@example.com");
    expect(m.maskText(SECRET_TEXT)).not.toContain("alice@example.com");
    expect(m.maskFilePath(SECRET_PATH)).not.toBe(SECRET_PATH);
    expect(m.redact(HANDLE)).not.toBe(HANDLE);
    expect(m.maskHandle(HANDLE)).not.toBe(HANDLE);
  });
});

describe("usePrivacyMask — the per-setting toggles still gate their own rule", () => {
  it("maskText leaves emails alone when maskEmails is off, even at screenshot level", () => {
    // Level-awareness widens WHEN masking applies; it must not override WHICH
    // rules the operator turned off.
    localStorage.setItem(
      "codepulse-privacy",
      JSON.stringify({
        enabled: false,
        maskPaths: true,
        maskEmails: false,
        maskKeys: true,
        maskIps: true,
        level: "screenshot",
      })
    );
    const m = renderHook(() => usePrivacyMask(), { wrapper }).result.current;

    expect(m.maskText(SECRET_TEXT)).toContain("alice@example.com");
    // ...while the IP rule, still on, does apply — the control proving the
    // helper ran at all rather than short-circuiting.
    expect(m.maskText(SECRET_TEXT)).not.toContain("10.0.0.44");
  });

  it("maskFilePath leaves paths alone when maskPaths is off", () => {
    localStorage.setItem(
      "codepulse-privacy",
      JSON.stringify({
        enabled: false,
        maskPaths: false,
        maskEmails: true,
        maskKeys: true,
        maskIps: true,
        level: "screenshot",
      })
    );
    const m = renderHook(() => usePrivacyMask(), { wrapper }).result.current;
    expect(m.maskFilePath(SECRET_PATH)).toBe(SECRET_PATH);
  });
});
