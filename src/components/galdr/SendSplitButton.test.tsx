/**
 * SendSplitButton — three targets, one of them blocking (D-12).
 *
 * Phase 116 (Galdr Prompt Library), plan 116-06 Task 2.
 *
 * The load-bearing assertion in this file is on the OBJECT the navigate spy
 * actually received, not on the component's internal state. `Chat.tsx:544-556`
 * fires `sendMessage(handoff.text)` inside an effect behind a `firedRef` guard
 * with no confirmation step — verified by reading it — so whatever `text` lands
 * in that handoff is what Ástríðr answers. A `{{` surviving into it is a defect
 * that no amount of correct-looking UI would catch.
 *
 * The negative control (unfilled dialog → zero navigate calls) is what makes the
 * positive assertion mean something: without it, a component that navigated on
 * every pick would still pass the payload-shape test.
 */
import { describe, test, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SendSplitButton, type GaldrPromptLike } from "./SendSplitButton";

// Radix DropdownMenu uses ResizeObserver internally — jsdom doesn't provide it
// (same shim as RunTargetChooser.test.tsx).
beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
  const actual =
    await vi.importActual<typeof import("react-router")>("react-router");
  return { ...actual, useNavigate: () => mockNavigate };
});

// Typed parameter, not `vi.fn(() => ...)`: an untyped mock infers `calls` as
// `[][]`, so `calls[0][0]` is a compile error rather than the asserted string.
const writeText = vi.fn((_text: string) => Promise.resolve());
Object.defineProperty(navigator, "clipboard", {
  value: { writeText },
  configurable: true,
  writable: true,
});

const WITH_VARS: GaldrPromptLike = {
  slug: "outreach-note",
  title: "Outreach note",
  body: "Draft a note for {{company}} about {{topic}}.",
  variables: ["company", "topic"],
};

const NO_VARS: GaldrPromptLike = {
  slug: "standup",
  title: "Standup",
  body: "Summarise yesterday in three bullets.",
  variables: [],
};

beforeEach(() => {
  mockNavigate.mockClear();
  writeText.mockClear();
});

function renderButton(prompt: GaldrPromptLike) {
  const onUsage = vi.fn();
  render(<SendSplitButton prompt={prompt} onUsage={onUsage} />);
  return { onUsage };
}

/** Radix's DropdownMenuTrigger opens on pointerdown, not click. */
async function openMenu(promptTitle: string) {
  fireEvent.pointerDown(
    screen.getByRole("button", {
      name: `Choose send target for ${promptTitle}`,
    }),
    { button: 0, ctrlKey: false }
  );
  return screen.findByRole("menu");
}

async function pick(promptTitle: string, label: string) {
  await openMenu(promptTitle);
  const item = await screen.findByText(label);
  await act(async () => {
    fireEvent.click(item);
  });
}

function fill(variableName: string, value: string) {
  act(() => {
    fireEvent.change(screen.getByLabelText(variableName), {
      target: { value },
    });
  });
}

describe("SendSplitButton — Send to Chat", () => {
  test("with variables: opens the dialog and does NOT navigate", async () => {
    renderButton(WITH_VARS);
    await pick(WITH_VARS.title, "Send to Chat");

    expect(screen.getByLabelText("company")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("negative control: variables left unfilled produces zero navigate calls", async () => {
    renderButton(WITH_VARS);
    await pick(WITH_VARS.title, "Send to Chat");
    fill("company", "ProtectAll"); // only one of two

    const send = screen.getByRole("button", { name: /send to chat/i });
    await act(async () => {
      fireEvent.click(send);
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("with variables filled: navigates with a resolved payload and bumps usage", async () => {
    const { onUsage } = renderButton(WITH_VARS);
    await pick(WITH_VARS.title, "Send to Chat");
    fill("company", "ProtectAll");
    fill("topic", "renewals");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /send to chat/i }));
    });

    expect(mockNavigate).toHaveBeenCalledWith("/chat", {
      state: {
        autoSend: {
          text: "Draft a note for ProtectAll about renewals.",
          skillName: "galdr:outreach-note",
        },
      },
    });
    expect(mockNavigate.mock.calls[0][1].state.autoSend.text).not.toContain(
      "{{"
    );
    expect(onUsage).toHaveBeenCalledWith("outreach-note");
  });

  test("with no variables: navigates immediately, no dialog", async () => {
    const { onUsage } = renderButton(NO_VARS);
    await pick(NO_VARS.title, "Send to Chat");

    expect(mockNavigate).toHaveBeenCalledWith("/chat", {
      state: {
        autoSend: {
          text: "Summarise yesterday in three bullets.",
          skillName: "galdr:standup",
        },
      },
    });
    expect(onUsage).toHaveBeenCalledWith("standup");
  });
});

describe("SendSplitButton — Copy", () => {
  test("with variables: opens the dialog and does NOT write to the clipboard", async () => {
    renderButton(WITH_VARS);
    await pick(WITH_VARS.title, "Copy");

    expect(screen.getByLabelText("company")).toBeInTheDocument();
    expect(writeText).not.toHaveBeenCalled();
  });

  test("with variables filled: writes the resolved body and bumps usage", async () => {
    const { onUsage } = renderButton(WITH_VARS);
    await pick(WITH_VARS.title, "Copy");
    fill("company", "ProtectAll");
    fill("topic", "renewals");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^copy$/i }));
    });

    expect(writeText).toHaveBeenCalledWith(
      "Draft a note for ProtectAll about renewals."
    );
    expect(writeText.mock.calls[0][0]).not.toContain("{{");
    expect(onUsage).toHaveBeenCalledWith("outreach-note");
  });
});

describe("SendSplitButton — Copy as command", () => {
  test("writes /galdr <slug> immediately, with no dialog and no usage bump", async () => {
    const { onUsage } = renderButton(WITH_VARS);
    await pick(WITH_VARS.title, "Copy as command");

    expect(writeText).toHaveBeenCalledWith("/galdr outreach-note");
    expect(screen.queryByLabelText("company")).toBeNull();
    // The eventual `/galdr <slug>` run is what bumps the count, not the copy.
    expect(onUsage).not.toHaveBeenCalled();
  });
});
