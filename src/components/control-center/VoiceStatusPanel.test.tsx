import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VoiceStatusPanel } from "./VoiceStatusPanel";
import type { VoiceState } from "@/components/voice/voiceState";

const ALL_STATES: VoiceState[] = [
  "idle",
  "listening",
  "transcribing",
  "processing",
  "speaking",
  "error-disabled",
];

describe("VoiceStatusPanel", () => {
  it("renders exactly six chips, one per VoiceState", () => {
    render(<VoiceStatusPanel state="idle" />);
    for (const s of ALL_STATES) {
      expect(screen.getByTestId(`voice-status-chip-${s}`)).toBeInTheDocument();
    }
    expect(
      screen.getAllByTestId((id) => id.startsWith("voice-status-chip-"))
    ).toHaveLength(6);
  });

  it.each(ALL_STATES)("marks exactly one chip active for state=%s", (state) => {
    render(<VoiceStatusPanel state={state} />);
    for (const s of ALL_STATES) {
      const chip = screen.getByTestId(`voice-status-chip-${s}`);
      if (s === state) {
        expect(chip.className).toContain("text-primary");
      } else {
        expect(chip.className).not.toContain("text-primary");
      }
    }
  });

  it("renders the VOICE STATUS header", () => {
    render(<VoiceStatusPanel state="idle" />);
    expect(screen.getByText("VOICE STATUS")).toBeInTheDocument();
  });

  it("re-renders with an unchanged state without touching the aria-live region", () => {
    const { container, rerender } = render(<VoiceStatusPanel state="idle" />);
    const live = container.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(live).toHaveTextContent("IDLE");

    const observer = new MutationObserver(() => {});
    observer.observe(live, { childList: true, characterData: true, subtree: true });

    rerender(<VoiceStatusPanel state="idle" />);
    rerender(<VoiceStatusPanel state="idle" />);

    const records = observer.takeRecords();
    observer.disconnect();
    expect(records).toHaveLength(0);
  });

  it("produces exactly one new announcement on a real state change", () => {
    const { container, rerender } = render(<VoiceStatusPanel state="idle" />);
    const live = container.querySelector('[aria-live="polite"]') as HTMLElement;

    const observer = new MutationObserver(() => {});
    observer.observe(live, { childList: true, characterData: true, subtree: true });

    rerender(<VoiceStatusPanel state="listening" />);

    const records = observer.takeRecords();
    observer.disconnect();
    expect(records.length).toBeGreaterThanOrEqual(1);
    expect(live).toHaveTextContent("LISTENING");
  });
});
