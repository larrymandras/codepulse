import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ZipImportDialog from "./ZipImportDialog";

vi.mock("@/lib/openDesignApi", () => ({
  importClaudeDesign: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { importClaudeDesign } from "@/lib/openDesignApi";
const mockImportClaudeDesign = vi.mocked(importClaudeDesign);

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  onImportComplete: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ZipImportDialog", () => {
  it("renders dialog with heading and file input when open", () => {
    render(<ZipImportDialog {...defaultProps} />);

    expect(screen.getByText("Import Claude Design ZIP")).toBeInTheDocument();
    expect(screen.getByText(/Select a ZIP file/)).toBeInTheDocument();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();
    expect(fileInput.accept).toBe(".zip");
  });

  it("Import ZIP button is disabled when no file selected", () => {
    render(<ZipImportDialog {...defaultProps} />);

    const importButton = screen.getByRole("button", { name: "Import ZIP" });
    expect(importButton).toBeDisabled();
  });

  it("ZIP import triggers importClaudeDesign with selected file", async () => {
    const mockProject = { id: "proj-1", name: "Test", created_at: 1000, updated_at: 1000 };
    mockImportClaudeDesign.mockResolvedValue(mockProject as any);

    render(<ZipImportDialog {...defaultProps} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["zip content"], "design.zip", { type: "application/zip" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    const importButton = screen.getByRole("button", { name: "Import ZIP" });
    expect(importButton).not.toBeDisabled();

    fireEvent.click(importButton);

    await waitFor(() => {
      expect(mockImportClaudeDesign).toHaveBeenCalledWith(file);
    });
  });

  it("error state displayed when importClaudeDesign rejects", async () => {
    mockImportClaudeDesign.mockRejectedValue(new Error("Network error"));

    render(<ZipImportDialog {...defaultProps} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["zip content"], "design.zip", { type: "application/zip" });

    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Import ZIP" }));

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("success triggers onImportComplete callback and closes dialog", async () => {
    const mockProject = { id: "proj-1", name: "Test", created_at: 1000, updated_at: 1000 };
    mockImportClaudeDesign.mockResolvedValue(mockProject as any);

    const onImportComplete = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ZipImportDialog
        open={true}
        onOpenChange={onOpenChange}
        onImportComplete={onImportComplete}
      />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["zip content"], "design.zip", { type: "application/zip" });

    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Import ZIP" }));

    await waitFor(() => {
      expect(onImportComplete).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
