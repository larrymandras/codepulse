import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SkillRow } from "./SkillRow";
import { DORMANT_ORIGIN } from "@/lib/skills";

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
});

const skill = {
  name: "legal-nda",
  displayName: "NDA Generator",
  description: "Generate NDAs",
  overrideDescription: null,
  origins: ["claude-code"],
  useCount: 5,
  favorite: false,
};

const handlers = () => ({
  onRecordUse: vi.fn(),
  onOpenInChat: vi.fn(),
  onEdit: vi.fn(),
  onToggleFavorite: vi.fn(),
});

describe("SkillRow", () => {
  it("copy is the primary action: copies invocation, records use, shows Copied", async () => {
    const h = handlers();
    render(<SkillRow skill={skill} {...h} />);
    fireEvent.click(screen.getByRole("button", { name: /copy \/legal-nda/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("/legal-nda"));
    expect(h.onRecordUse).toHaveBeenCalledWith("legal-nda");
    await waitFor(() => expect(screen.getByText("Copied")).toBeTruthy());
  });

  it("shows Failed when the clipboard rejects", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    const h = handlers();
    render(<SkillRow skill={skill} {...h} />);
    fireEvent.click(screen.getByRole("button", { name: /copy \/legal-nda/i }));
    await waitFor(() => expect(screen.getByText("Failed")).toBeTruthy());
    expect(h.onRecordUse).toHaveBeenCalledWith("legal-nda");
  });

  it("dormant skill renders a dormant badge and Dormant copy feedback", async () => {
    const h = handlers();
    render(<SkillRow skill={{ ...skill, origins: [DORMANT_ORIGIN] }} {...h} />);
    expect(screen.getByText("dormant")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /copy \/legal-nda/i }));
    await waitFor(() => expect(screen.getByText("Dormant")).toBeTruthy());
  });

  it("secondary actions: chat, edit, favorite", () => {
    const h = handlers();
    render(<SkillRow skill={skill} {...h} />);
    fireEvent.click(screen.getByLabelText("Open legal-nda in Chat"));
    expect(h.onOpenInChat).toHaveBeenCalledWith("legal-nda");
    fireEvent.click(screen.getByLabelText("Edit legal-nda"));
    expect(h.onEdit).toHaveBeenCalledWith("legal-nda");
    fireEvent.click(screen.getByLabelText("Toggle favorite legal-nda"));
    expect(h.onToggleFavorite).toHaveBeenCalledWith("legal-nda");
  });

  it("sets the drag payload to the skill name", () => {
    const h = handlers();
    const { container } = render(<SkillRow skill={skill} {...h} />);
    const row = container.querySelector('[data-skill="legal-nda"]')!;
    const setData = vi.fn();
    fireEvent.dragStart(row, { dataTransfer: { setData, effectAllowed: "" } });
    expect(setData).toHaveBeenCalledWith("text/plain", "legal-nda");
  });
});
