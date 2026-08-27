import { describe, it, expect } from "vitest";
import { maskHandle, maskContactHandle } from "./privacy";

/**
 * `maskHandle` masks a contact handle — the `sender` field on `messageRoutes`
 * rows, which astridr fills with whatever identifier the source channel uses.
 *
 * Two SHAPES occur in the live data (measured on the self-hosted instance
 * 2026-08-26): a bare numeric Telegram id, and a WhatsApp `<digits>@lid`. The
 * fixtures below reproduce those shapes with SYNTHETIC values — this repo is
 * public, and real account identifiers do not belong in test data even when
 * they are only the operator's own.
 *   telegram-shaped   5550101234
 *   whatsapp-shaped   99887766554433@lid
 *
 * The masked form must stay DISTINGUISHING — the Message Routing surface shows
 * one sender per channel, and a mask that collapsed every handle to "***"
 * would make two different people's handles render identically.
 */

describe("maskHandle — the two live handle shapes", () => {
  it("masks the middle of a bare phone-style handle, keeping the ends", () => {
    expect(maskHandle("5550101234")).toBe("55***34");
  });

  it("masks the local part of an @-suffixed handle but keeps the suffix", () => {
    // The `@lid` suffix is a WhatsApp identifier TYPE, not personal data, and
    // it is what tells a reader which flavour of id this is. Same rule
    // maskEmail already applies to a domain.
    expect(maskHandle("99887766554433@lid")).toBe("99***33@lid");
  });
});

describe("maskHandle — stays distinguishing", () => {
  it("maps two different handles to two different masked forms", () => {
    // If this collapses, the surface shows two senders as one.
    expect(maskHandle("5550101234")).not.toBe(maskHandle("99887766554433@lid"));
  });

  it("is deterministic — the same handle masks the same way every time", () => {
    expect(maskHandle("5550101234")).toBe(maskHandle("5550101234"));
  });
});

describe("maskHandle — other shapes it may meet", () => {
  it("handles an E.164 number with a leading +", () => {
    expect(maskHandle("+15551234567")).toBe("+1***67");
  });

  it("fully masks a handle too short to partially mask", () => {
    // Keeping 2+2 of a 4-character handle would reveal the whole thing.
    expect(maskHandle("abcd")).toBe("***");
    expect(maskHandle("ab")).toBe("***");
  });

  it("returns an empty string unchanged rather than emitting stars for nothing", () => {
    expect(maskHandle("")).toBe("");
  });

  it("splits on the LAST @, so an @ inside the local part does not leak the tail", () => {
    expect(maskHandle("ab@cd1234@lid")).toBe("ab***34@lid");
  });
});

describe("maskContactHandle — the privacy-mode gate", () => {
  it("masks when privacy mode is on", () => {
    expect(maskContactHandle("5550101234", true)).toBe("55***34");
  });

  it("returns the raw handle when privacy mode is off", () => {
    // Mirrors maskFilePath/maskText: the gate is the caller's `enabled` flag,
    // not a decision baked into the masker.
    expect(maskContactHandle("5550101234", false)).toBe("5550101234");
  });
});
