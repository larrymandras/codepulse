import { describe, it } from "vitest";

describe("uploadEmailAsset", () => {
  it.todo("does NOT include Content-Type header in FormData request");
  it.todo("includes Authorization header when API key is set");
  it.todo("sends file as FormData with folder query parameter");
});

describe("fetchLayouts", () => {
  it.todo("appends is_active=eq.true query parameter");
});

describe("fetchEmailAssets", () => {
  it.todo("calls GET /api/email-assets");
  it.todo("passes folder parameter when provided");
});
