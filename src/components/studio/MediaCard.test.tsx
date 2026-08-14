/**
 * MediaCard — D-07 provenance control pair, broken-thumbnail fallback, the
 * audio placeholder, and the star overlay's `stopPropagation` separation
 * (Phase 118, plan 118-10 Task 2).
 *
 * Every assertion here is paired with a control per the plan's mutation-test
 * rule: a passing check that would look identical if the behavior it claims
 * to guard were broken is not evidence.
 */
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MediaCard, type MediaRow } from "./MediaCard";

function makeRow(overrides: Partial<MediaRow> = {}): MediaRow {
  return {
    _id: "m1",
    filename: "sunset.webp",
    absPath: "C:\\secret\\media-vault\\gen\\sunset.webp",
    mediaType: "image",
    kind: "gen",
    hasProvenance: true,
    thumbnailUrl: "https://example.test/thumb.webp",
    createdAt: 1000,
    ...overrides,
  };
}

describe("MediaCard — D-07 provenance control pair", () => {
  test("CONTROL: a complete-recipe row renders no provenance badge", () => {
    render(
      <MediaCard row={makeRow({ hasProvenance: true })} onOpen={vi.fn()} onToggleStar={vi.fn()} />
    );
    expect(screen.queryByText("No provenance recorded")).not.toBeInTheDocument();
  });

  test("a provenance-absent row renders the badge on the card itself", () => {
    render(
      <MediaCard row={makeRow({ hasProvenance: false })} onOpen={vi.fn()} onToggleStar={vi.fn()} />
    );
    expect(screen.getByText("No provenance recorded")).toBeInTheDocument();
  });
});

describe("MediaCard — broken/missing thumbnail fallback (D-01 neutrality)", () => {
  test("CONTROL: a real thumbnailUrl renders an <img>, not the fallback", () => {
    render(<MediaCard row={makeRow()} onOpen={vi.fn()} onToggleStar={vi.fn()} />);
    expect(screen.queryByText("Thumbnail unavailable")).not.toBeInTheDocument();
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  test("a null thumbnailUrl renders the fallback, never a broken <img>", () => {
    render(<MediaCard row={makeRow({ thumbnailUrl: null })} onOpen={vi.fn()} onToggleStar={vi.fn()} />);
    expect(screen.getByText("Thumbnail unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  test("an <img onError> swaps to the fallback", () => {
    render(<MediaCard row={makeRow()} onOpen={vi.fn()} onToggleStar={vi.fn()} />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByText("Thumbnail unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  test("the row stays clickable and star-able when the thumbnail is broken", () => {
    const onOpen = vi.fn();
    const onToggleStar = vi.fn();
    render(
      <MediaCard row={makeRow({ thumbnailUrl: null })} onOpen={onOpen} onToggleStar={onToggleStar} />
    );
    fireEvent.click(screen.getByText("Thumbnail unavailable"));
    expect(onOpen).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("studio-media-star-m1"));
    expect(onToggleStar).toHaveBeenCalledTimes(1);
  });
});

describe("MediaCard — audio placeholder is expected, not an error", () => {
  test("CONTROL: an image row never renders the audio placeholder", () => {
    render(<MediaCard row={makeRow({ mediaType: "image" })} onOpen={vi.fn()} onToggleStar={vi.fn()} />);
    expect(screen.queryByTestId("studio-media-audio-m1")).not.toBeInTheDocument();
  });

  test("an audio row renders the audio placeholder, never an <img> or the broken-thumbnail copy", () => {
    render(
      <MediaCard row={makeRow({ mediaType: "audio", thumbnailUrl: null })} onOpen={vi.fn()} onToggleStar={vi.fn()} />
    );
    expect(screen.getByTestId("studio-media-audio-m1")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByText("Thumbnail unavailable")).not.toBeInTheDocument();
  });
});

describe("MediaCard — star overlay stopPropagation separation", () => {
  test("CONTROL: clicking the thumbnail calls onOpen", () => {
    const onOpen = vi.fn();
    render(<MediaCard row={makeRow()} onOpen={onOpen} onToggleStar={vi.fn()} />);
    fireEvent.click(screen.getByRole("img"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  test("clicking the star toggles favorite and never opens the card", () => {
    const onOpen = vi.fn();
    const onToggleStar = vi.fn();
    render(<MediaCard row={makeRow()} onOpen={onOpen} onToggleStar={onToggleStar} />);
    fireEvent.click(screen.getByTestId("studio-media-star-m1"));
    expect(onToggleStar).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  test("CONTROL: the filled star uses var(--status-warn), never a hardcoded amber", () => {
    render(<MediaCard row={makeRow({ starred: true })} onOpen={vi.fn()} onToggleStar={vi.fn()} />);
    const star = screen.getByTestId("studio-media-star-m1").querySelector("svg");
    expect(star).toHaveStyle({ fill: "var(--status-warn)", color: "var(--status-warn)" });
  });

  test("an unstarred row's star carries no inline fill", () => {
    render(<MediaCard row={makeRow({ starred: false })} onOpen={vi.fn()} onToggleStar={vi.fn()} />);
    const star = screen.getByTestId("studio-media-star-m1").querySelector("svg");
    expect(star?.getAttribute("style")).toBeFalsy();
  });
});

describe("MediaCard — D-02 the original file never becomes a fetchable URL", () => {
  test("the rendered <img src> is thumbnailUrl, never absPath", () => {
    const row = makeRow();
    render(<MediaCard row={row} onOpen={vi.fn()} onToggleStar={vi.fn()} />);
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toBe(row.thumbnailUrl);
    expect(img.src).not.toContain("secret");
  });
});
