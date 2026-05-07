import { describe, it } from "vitest";

describe("StreamingPreview", () => {
  describe("extractArtifact", () => {
    it.todo("extracts HTML content from <artifact> tags in accumulated text");
    it.todo("returns null when no artifact tags present");
    it.todo("handles partial artifact tags during streaming");
  });

  describe("srcdoc iframe", () => {
    it.todo("receives extracted HTML as srcDoc prop");
    it.todo("uses sandbox='allow-scripts' without allow-same-origin");
  });

  describe("SSE consumption", () => {
    it.todo("calls streamRunEvents when runId changes");
    it.todo("resets state on new runId");
    it.todo("aborts stream on unmount");
  });
});
