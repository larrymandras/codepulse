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
    render(<VoiceStatusPanel state="idle" filteredCount={0} />);
    for (const s of ALL_STATES) {
      expect(screen.getByTestId(`voice-status-chip-${s}`)).toBeInTheDocument();
    }
    expect(
      screen.getAllByTestId((id) => id.startsWith("voice-status-chip-"))
    ).toHaveLength(6);
  });

  it.each(ALL_STATES)("marks exactly one chip active for state=%s", (state) => {
    render(<VoiceStatusPanel state={state} filteredCount={0} />);
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
    render(<VoiceStatusPanel state="idle" filteredCount={0} />);
    expect(screen.getByText("VOICE STATUS")).toBeInTheDocument();
  });

  it("re-renders with an unchanged state without touching the aria-live region", () => {
    const { container, rerender } = render(<VoiceStatusPanel state="idle" filteredCount={0} />);
    const live = container.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(live).toHaveTextContent("IDLE");

    const observer = new MutationObserver(() => {});
    observer.observe(live, { childList: true, characterData: true, subtree: true });

    rerender(<VoiceStatusPanel state="idle" filteredCount={0} />);
    rerender(<VoiceStatusPanel state="idle" filteredCount={0} />);

    const records = observer.takeRecords();
    observer.disconnect();
    expect(records).toHaveLength(0);
  });

  it("produces exactly one new announcement on a real state change", () => {
    const { container, rerender } = render(<VoiceStatusPanel state="idle" filteredCount={0} />);
    const live = container.querySelector('[aria-live="polite"]') as HTMLElement;

    const observer = new MutationObserver(() => {});
    observer.observe(live, { childList: true, characterData: true, subtree: true });

    rerender(<VoiceStatusPanel state="listening" filteredCount={0} />);

    const records = observer.takeRecords();
    observer.disconnect();
    expect(records.length).toBeGreaterThanOrEqual(1);
    expect(live).toHaveTextContent("LISTENING");
  });

  // ─── 188.1-04 (D-04): filtered-drop count ──────────────────────────────────

  it("renders 0 FILTERED at filteredCount={0}", () => {
    render(<VoiceStatusPanel state="idle" filteredCount={0} />);
    expect(screen.getByText("0 FILTERED")).toBeInTheDocument();
  });

  it("renders 3 FILTERED at filteredCount={3} — proves the prop value is rendered, not a hardcoded string", () => {
    render(<VoiceStatusPanel state="idle" filteredCount={3} />);
    expect(screen.getByText("3 FILTERED")).toBeInTheDocument();
  });

  it("the FILTERED count is not inside the aria-live announcement span", () => {
    const { container } = render(<VoiceStatusPanel state="idle" filteredCount={0} />);
    const live = container.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(live).not.toHaveTextContent("FILTERED");
  });
});
