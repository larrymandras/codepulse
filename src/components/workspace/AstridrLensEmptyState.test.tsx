/**
 * AstridrLensEmptyState — proof the three probe states render differently.
 *
 * Asserts on user-visible text (screen.getByText / queryByText), never on
 * class names or test ids, so these survive styling changes.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { AstridrLensEmptyState } from "./AstridrLensEmptyState";

const HEADING = "Ástríðr's world isn't mapped yet";
const BODY_SNIPPET = /ARMS inventory \(Skills, Memory, Routines, Applications\) hasn't been built/;
const ACTION_LABEL = "View Larry's Workspace";

describe("AstridrLensEmptyState", () => {
  it("armsPresent=undefined: probe still resolving — no heading, no action", () => {
    render(
      <AstridrLensEmptyState armsPresent={undefined} onSwitchToWorkspace={vi.fn()} />
    );

    expect(screen.queryByText(HEADING)).not.toBeInTheDocument();
    expect(screen.queryByText(ACTION_LABEL)).not.toBeInTheDocument();
  });

  it("armsPresent=false: heading, full body sentence, and action are present", () => {
    render(
      <AstridrLensEmptyState armsPresent={false} onSwitchToWorkspace={vi.fn()} />
    );

    expect(screen.getByText(HEADING)).toBeInTheDocument();
    expect(screen.getByText(BODY_SNIPPET)).toBeInTheDocument();
    expect(screen.getByText(ACTION_LABEL)).toBeInTheDocument();
  });

  it("armsPresent=true: the load-bearing assertion — heading absent even though the probe answered", () => {
    // This is the ONLY assertion in this file that can distinguish a live
    // probe from a hardcoded string. A suite that only tested the `false`
    // case would pass identically against a component that ignored the
    // `armsPresent` prop entirely and always rendered the "isn't mapped yet"
    // copy — proving nothing about D-11's "driven by a live probe" property.
    render(
      <AstridrLensEmptyState armsPresent={true} onSwitchToWorkspace={vi.fn()} />
    );

    expect(screen.queryByText(HEADING)).not.toBeInTheDocument();
  });

  it("clicking 'View Larry's Workspace' calls onSwitchToWorkspace exactly once", () => {
    const onSwitchToWorkspace = vi.fn();
    render(
      <AstridrLensEmptyState armsPresent={false} onSwitchToWorkspace={onSwitchToWorkspace} />
    );

    fireEvent.click(screen.getByText(ACTION_LABEL));

    expect(onSwitchToWorkspace).toHaveBeenCalledTimes(1);
  });
});
