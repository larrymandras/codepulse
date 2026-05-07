import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ExportPanel from "./ExportPanel";

// Mock the API module
vi.mock("@/lib/openDesignApi", () => ({
  exportProject: vi.fn(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { exportProject } from "@/lib/openDesignApi";
const mockExportProject = vi.mocked(exportProject);

// Minimal URL API stubs for jsdom
const createObjectURLMock = vi.fn(() => "blob:mock-url");
const revokeObjectURLMock = vi.fn();
global.URL.createObjectURL = createObjectURLMock;
global.URL.revokeObjectURL = revokeObjectURLMock;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ExportPanel", () => {
  describe("format selection", () => {
    it("renders all 5 export format buttons: html, pdf, pptx, zip, md", () => {
      render(<ExportPanel projectId="proj-1" />);

      expect(screen.getByRole("button", { name: /html/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /pdf/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /pptx/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /zip/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /md/i })).toBeInTheDocument();
    });

    it("defaults to html format (html button has accent styling)", () => {
      render(<ExportPanel projectId="proj-1" />);

      const htmlButton = screen.getByRole("button", { name: /html/i });
      // The selected button has font-medium applied (accent class)
      expect(htmlButton.className).toContain("font-medium");
      // Other format buttons should not have font-medium
      const pdfButton = screen.getByRole("button", { name: /pdf/i });
      expect(pdfButton.className).not.toContain("font-medium");
    });

    it("highlights selected format after click", () => {
      render(<ExportPanel projectId="proj-1" />);

      const pdfButton = screen.getByRole("button", { name: /pdf/i });
      fireEvent.click(pdfButton);

      expect(pdfButton.className).toContain("font-medium");
      // html should no longer be selected
      const htmlButton = screen.getByRole("button", { name: /html/i });
      expect(htmlButton.className).not.toContain("font-medium");
    });
  });

  describe("download", () => {
    it("calls exportProject with selected format and projectId", async () => {
      mockExportProject.mockResolvedValue(new Blob(["<html/>"], { type: "text/html" }));

      render(<ExportPanel projectId="proj-abc" />);

      // Select pptx
      fireEvent.click(screen.getByRole("button", { name: /pptx/i }));

      // Click download
      const downloadBtn = screen.getByRole("button", { name: /download file/i });
      fireEvent.click(downloadBtn);

      await waitFor(() => {
        expect(mockExportProject).toHaveBeenCalledWith("proj-abc", "pptx");
      });
    });

    it("triggers blob download via URL.createObjectURL", async () => {
      const blob = new Blob(["content"], { type: "text/html" });
      mockExportProject.mockResolvedValue(blob);

      render(<ExportPanel projectId="proj-abc" />);

      fireEvent.click(screen.getByRole("button", { name: /download file/i }));

      await waitFor(() => {
        expect(createObjectURLMock).toHaveBeenCalledWith(blob);
        expect(revokeObjectURLMock).toHaveBeenCalled();
      });
    });

    it("displays error on export failure", async () => {
      mockExportProject.mockRejectedValue(new Error("Daemon unreachable"));

      render(<ExportPanel projectId="proj-err" />);

      fireEvent.click(screen.getByRole("button", { name: /download file/i }));

      await waitFor(() => {
        expect(
          screen.getByText("Export failed. Check daemon connection and try again."),
        ).toBeInTheDocument();
      });
    });

    it("download button is disabled when projectId is null", () => {
      render(<ExportPanel projectId={null} />);

      const downloadBtn = screen.getByRole("button", { name: /download file/i });
      expect(downloadBtn).toBeDisabled();
    });
  });
});
