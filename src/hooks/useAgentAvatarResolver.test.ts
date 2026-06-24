import { describe, it, expect } from "vitest";
import { buildAvatarIndex, normAgentKey } from "./useAgentAvatarResolver";

// Minimal structural fixtures mirroring the avatars/agentProfiles records.
const HERVOR = { _id: "av1", name: "Hervor", emoji: "⚔️", imageStorageId: "img-hervor" as never };
const ASTRIDR = { _id: "av2", name: "Ástríðr", emoji: "⚡", imageStorageId: "img-astridr" as never };
const HASH_NOIMG = { _id: "av3", name: "Hervor", emoji: "🙂" }; // collision, no image

describe("normAgentKey", () => {
  it("lowercases and trims", () => {
    expect(normAgentKey("  Hervor ")).toBe("hervor");
  });
  it("NFC-normalizes special characters so Ástríðr matches", () => {
    expect(normAgentKey("Ástríðr")).toBe(normAgentKey("ástríðr"));
  });
});

describe("buildAvatarIndex", () => {
  it("resolves a persona name case-insensitively (hervor → Hervor)", () => {
    const idx = buildAvatarIndex([HERVOR], []);
    expect(idx.get(normAgentKey("hervor"))?.name).toBe("Hervor");
    expect(idx.get(normAgentKey("HERVOR"))?.imageStorageId).toBe("img-hervor");
  });

  it("resolves Ástríðr across casing/diacritics for the Queen", () => {
    const idx = buildAvatarIndex([ASTRIDR], []);
    expect(idx.get(normAgentKey("Ástríðr"))?.name).toBe("Ástríðr");
    expect(idx.get(normAgentKey("ástríðr"))?.emoji).toBe("⚡");
  });

  it("prefers the image-bearing record on a name collision", () => {
    // order: no-image first, image second — image should win regardless of order
    const idx = buildAvatarIndex([HASH_NOIMG, HERVOR], []);
    expect(idx.get(normAgentKey("hervor"))?.imageStorageId).toBe("img-hervor");
  });

  it("resolves via the agentProfiles.avatarId chain (profileId + name)", () => {
    const profiles = [{ profileId: "a58ab607", name: "a58ab607", avatarId: "av1" }];
    const idx = buildAvatarIndex([HERVOR], profiles);
    expect(idx.get(normAgentKey("a58ab607"))?.name).toBe("Hervor");
  });

  it("returns no entry for an unknown key", () => {
    const idx = buildAvatarIndex([HERVOR], []);
    expect(idx.get(normAgentKey("nobody"))).toBeUndefined();
  });
});
