import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SkillPills } from "./SkillPills";
import { DORMANT_ORIGIN } from "@/lib/skills";

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
});

const skills = [
  { name: "gsd-code-review", origins: ["claude-code"], useCount: 11 },
  { name: "legal-nda", origins: ["claude-code"], useCount: 3, command: "/legal nda <file>" },
  { name: "cold-thing", origins: [DORMANT_ORIGIN], useCount: 99 },
  { name: "never-used", origins: ["claude-code"], useCount: 0 },
];

describe("SkillPills", () => {
  it("renders most-used first and excludes dormant + never-used skills", () => {
    render(<SkillPills skills={skills} onUse={vi.fn()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveTextContent("/gsd-code-review");
    expect(buttons[1]).toHaveTextContent("/legal nda"); // arg placeholder stripped
    expect(screen.queryByText(/cold-thing/)).toBeNull();
    expect(screen.queryByText(/never-used/)).toBeNull();
  });

  it("copies the invocation and records the use", async () => {
    const onUse = vi.fn();
    render(<SkillPills skills={skills} onUse={onUse} />);
    screen.getAllByRole("button")[0].click();
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("/gsd-code-review"));
    expect(onUse).toHaveBeenCalledWith("gsd-code-review");
    await waitFor(() => expect(screen.getByText("copied")).toBeTruthy());
  });

  it("says 'copy failed' rather than lying when the clipboard rejects", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    const onUse = vi.fn();
    render(<SkillPills skills={skills} onUse={onUse} />);
    screen.getAllByRole("button")[0].click();
    await waitFor(() => expect(screen.getByText("copy failed")).toBeTruthy());
    expect(screen.queryByText("copied")).toBeNull();
    // usage is still recorded — the user did invoke the skill
    expect(onUse).toHaveBeenCalledWith("gsd-code-review");
  });

  it("renders nothing when no skill has ever been used", () => {
    const { container } = render(
      <SkillPills skills={[{ name: "a", origins: ["claude-code"], useCount: 0 }]} onUse={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });
});
