import { describe, it, expect } from "vitest";
import {
  ALL_PROVIDERS as BACKEND_PROVIDERS,
  PROVIDER_BILLING as BACKEND_BILLING,
} from "../../convex/lib/providers";
import {
  ALL_PROVIDERS as FRONTEND_PROVIDERS,
  PROVIDER_BILLING as FRONTEND_BILLING,
} from "./providers";

describe("provider registry sync — WR-06", () => {
  it("frontend ALL_PROVIDERS matches backend ALL_PROVIDERS", () => {
    expect([...FRONTEND_PROVIDERS]).toEqual([...BACKEND_PROVIDERS]);
  });

  it("frontend PROVIDER_BILLING matches backend PROVIDER_BILLING", () => {
    expect(FRONTEND_BILLING).toEqual(BACKEND_BILLING);
  });
});
