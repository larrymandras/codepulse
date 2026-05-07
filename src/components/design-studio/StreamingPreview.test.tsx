import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import StreamingPreview, { extractArtifact } from "./StreamingPreview";

// jsdom does not implement scrollIntoView — stub it globally
Element.prototype.scrollIntoView = vi.fn();

// Mock the API module
vi.mock("@/lib/openDesignApi", () => ({
  streamRunEvents: vi.fn(),
}));

import { streamRunEvents } from "@/lib/openDesignApi";
const mockStreamRunEvents = vi.mocked(streamRunEvents);

beforeEach(() => {
  vi.clearAllMocks();
  // Default: do nothing (no stream events)
  mockStreamRunEvents.mockReturnValue(() => {});
});

describe("StreamingPreview", () => {
  describe("extractArtifact", () => {
    it("extracts HTML content from <artifact> tags in accumulated text", () => {
      const text = "Some preamble\n<artifact>\n<h1>Hello</h1>\n</artifact>\nSome epilogue";
      expect(extractArtifact(text)).toBe("<h1>Hello</h1>");
    });

    it("returns null when no artifact tags present", () => {
      const text = "This is plain text with no artifact tags at all.";
      expect(extractArtifact(text)).toBeNull();
    });

    it("handles partial artifact tags during streaming (no closing tag)", () => {
      // During streaming the closing tag may not have arrived yet
      const text = "Generating...\n<artifact>\n<html><body>partial content";
      expect(extractArtifact(text)).toBeNull();
    });

    it("is case-insensitive for artifact tag matching", () => {
      const text = "<ARTIFACT><div>content</div></ARTIFACT>";
      expect(extractArtifact(text)).toBe("<div>content</div>");
    });
  });

  describe("srcdoc iframe", () => {
    it("uses sandbox='allow-scripts' without allow-same-origin when iframeContent is set", () => {
      // Simulate a run that immediately emits a token with artifact content
      mockStreamRunEvents.mockImplementation((_runId, options) => {
        options.onToken("<artifact><h1>Test</h1></artifact>");
        return () => {};
      });

      render(
        <StreamingPreview
          runId="run-123"
          onGenerationComplete={() => {}}
          onRegenerate={() => {}}
        />,
      );

      const iframe = screen.getByTitle("Design Preview") as HTMLIFrameElement;

      // Primary security gate: sandbox must be exactly "allow-scripts"
      expect(iframe).toHaveAttribute("sandbox", "allow-scripts");

      // Critical: allow-same-origin MUST NOT be present (STRIDE T-01-11)
      const sandboxValue = iframe.getAttribute("sandbox") ?? "";
      expect(sandboxValue).not.toContain("allow-same-origin");
    });
  });

  describe("SSE consumption", () => {
    it("calls streamRunEvents when runId is provided", () => {
      render(
        <StreamingPreview
          runId="run-456"
          onGenerationComplete={() => {}}
          onRegenerate={() => {}}
        />,
      );

      expect(mockStreamRunEvents).toHaveBeenCalledWith(
        "run-456",
        expect.objectContaining({
          onToken: expect.any(Function),
          onError: expect.any(Function),
          onDone: expect.any(Function),
        }),
      );
    });

    it("does not call streamRunEvents when runId is null", () => {
      render(
        <StreamingPreview
          runId={null}
          onGenerationComplete={() => {}}
          onRegenerate={() => {}}
        />,
      );

      expect(mockStreamRunEvents).not.toHaveBeenCalled();
    });

    it("calls onGenerationComplete when stream emits onDone", () => {
      const onGenerationComplete = vi.fn();

      mockStreamRunEvents.mockImplementation((_runId, options) => {
        options.onDone({ code: 0, signal: null, status: "succeeded" });
        return () => {};
      });

      render(
        <StreamingPreview
          runId="run-789"
          onGenerationComplete={onGenerationComplete}
          onRegenerate={() => {}}
        />,
      );

      expect(onGenerationComplete).toHaveBeenCalledOnce();
    });
  });
});
