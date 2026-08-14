/**
 * Studio page — the honest-empty-state distinction and the filter chip's
 * actual filtering effect (Phase 118, plan 118-10).
 *
 * Phase 114's code review caught a real bug of exactly this shape: a
 * permanent loading skeleton sat next to a canvas correctly reporting "no
 * data" because the loading/empty signals were collapsed. Every assertion
 * below is paired with the OTHER state so a check that would look identical
 * if the distinction were broken is not evidence (2026-08 verification
 * discipline).
 *
 * Radix `Tabs.Content` unmounts inactive panels by default (no
 * `forceMount`), so only the active tab's `useQuery` call is live at a
 * given render — a single static mock return per test is sufficient; no
 * per-query discrimination against the `api` proxy is needed here.
 */
import { describe, test, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

const h = vi.hoisted(() => ({ queryResult: undefined as unknown }));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: () => h.queryResult,
}));

import Studio from "./Studio";
import { MediaCard, type MediaRow } from "@/components/studio/MediaCard";
import {
  MediaDetailSheet,
  NO_RECIPE_TOOLTIP_COPY,
  type MediaDetailRow,
} from "@/components/studio/MediaDetailSheet";
import { ModelsPanel } from "@/components/studio/ModelsPanel";
import { StylesPanel } from "@/components/studio/StylesPanel";

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    _id: "m1",
    filename: "sunset.webp",
    absPath: "C:\\media-vault\\gen\\sunset.webp",
    mediaType: "image",
    kind: "gen",
    hasProvenance: true,
    thumbnailUrl: "https://example.test/thumb.webp",
    createdAt: 1000,
    ...overrides,
  };
}

describe("Studio Gallery — loading vs loaded-but-empty", () => {
  test("loading (query undefined) shows skeletons, never the empty-state copy", () => {
    h.queryResult = undefined;
    render(<Studio />);
    expect(screen.getByTestId("studio-loading-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("No media yet")).not.toBeInTheDocument();
  });

  test("loaded but genuinely empty shows 'No media yet' and ZERO skeletons", () => {
    h.queryResult = { rows: [], cap: 500 };
    render(<Studio />);
    expect(screen.getByText("No media yet")).toBeInTheDocument();
    expect(screen.queryByTestId("studio-loading-skeleton")).not.toBeInTheDocument();
  });
});

describe("Studio Gallery — zero-match vs table-empty are different states", () => {
  test("rows exist but the search matches none: zero-match, NOT 'No media yet'", () => {
    h.queryResult = { rows: [makeRow()], cap: 500 };
    render(<Studio />);
    fireEvent.change(screen.getByLabelText("Search media"), {
      target: { value: "zzz-does-not-exist-anywhere" },
    });
    expect(screen.getByText("[ NO MEDIA MATCHES ]")).toBeInTheDocument();
    expect(screen.queryByText("No media yet")).not.toBeInTheDocument();
  });

  test("CONTROL: the same rows with no search render the grid, not either empty state", () => {
    h.queryResult = { rows: [makeRow()], cap: 500 };
    render(<Studio />);
    expect(screen.getByTestId("studio-media-card-m1")).toBeInTheDocument();
    expect(screen.queryByText("[ NO MEDIA MATCHES ]")).not.toBeInTheDocument();
    expect(screen.queryByText("No media yet")).not.toBeInTheDocument();
  });
});

describe("Studio Trash — loading/empty/zero-match mirrors Gallery", () => {
  test("loaded but genuinely empty shows 'Trash is empty'", () => {
    h.queryResult = { rows: [], cap: 500 };
    render(<Studio />);
    // Radix's TabsTrigger activates on mousedown, not click (`onMouseDown`
    // calls `context.onValueChange`; a bare `fireEvent.click` never fires it).
    fireEvent.mouseDown(screen.getByTestId("studio-tab-trash"));
    expect(screen.getByText("Trash is empty")).toBeInTheDocument();
  });

  test("trashed rows exist but the search matches none: zero-match, NOT 'Trash is empty'", () => {
    h.queryResult = { rows: [makeRow({ deletedAt: 2000, daysUntilPurge: 10 })], cap: 500 };
    render(<Studio />);
    // Radix's TabsTrigger activates on mousedown, not click (`onMouseDown`
    // calls `context.onValueChange`; a bare `fireEvent.click` never fires it).
    fireEvent.mouseDown(screen.getByTestId("studio-tab-trash"));
    fireEvent.change(screen.getByLabelText("Search media"), {
      target: { value: "zzz-does-not-exist-anywhere" },
    });
    expect(screen.getByText("[ NO MEDIA MATCHES ]")).toBeInTheDocument();
    expect(screen.queryByText("Trash is empty")).not.toBeInTheDocument();
  });
});

describe("Studio Gallery — the Missing Provenance chip actually changes the rendered content", () => {
  test("clicking the chip removes the complete-recipe card and keeps the provenance-absent one", () => {
    h.queryResult = {
      rows: [
        makeRow({ _id: "complete", hasProvenance: true }),
        makeRow({ _id: "no-prov", hasProvenance: false }),
      ],
      cap: 500,
    };
    render(<Studio />);

    // CONTROL: before clicking, both cards are present.
    expect(screen.getByTestId("studio-media-card-complete")).toBeInTheDocument();
    expect(screen.getByTestId("studio-media-card-no-prov")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("studio-chip-missing-provenance"));

    expect(screen.queryByTestId("studio-media-card-complete")).not.toBeInTheDocument();
    expect(screen.getByTestId("studio-media-card-no-prov")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Plan 118-11 — the detail Sheet, the Trash countdown, and the curated panels
// ---------------------------------------------------------------------------

function makeDetailRow(
  overrides: Partial<MediaDetailRow> = {}
): MediaDetailRow {
  return {
    _id: "d1",
    filename: "sunset.webp",
    absPath: "C:\\media-vault\\gen\\sunset.webp",
    mediaType: "image",
    kind: "gen",
    hasProvenance: true,
    thumbnailUrl: "https://example.test/thumb.webp",
    createdAt: 1_700_000_000_000,
    prompt: "a low sun over a salt flat",
    model: "flux-1.1-pro",
    provider: "replicate",
    ...overrides,
  };
}

function makeCardRow(overrides: Partial<MediaRow> = {}): MediaRow {
  return {
    _id: "c1",
    filename: "sunset.webp",
    absPath: "C:\\media-vault\\gen\\sunset.webp",
    mediaType: "image",
    kind: "gen",
    hasProvenance: true,
    thumbnailUrl: "https://example.test/thumb.webp",
    createdAt: 1000,
    ...overrides,
  };
}

describe("MediaDetailSheet — D-07's control pair at FIELD level", () => {
  test("a populated field and an absent field render with DIFFERENT class strings in the same panel", () => {
    // Asserting only the absent case would pass against a component that
    // rendered the sentinel unconditionally — so both halves are measured
    // here and the assertion is that they DIFFER.
    render(
      <MediaDetailSheet
        row={makeDetailRow({ prompt: "a low sun over a salt flat", project: undefined })}
        open
        onOpenChange={vi.fn()}
      />
    );
    const populated = screen.getByTestId("studio-detail-field-prompt");
    const absent = screen.getByTestId("studio-detail-field-project");

    expect(populated).toHaveTextContent("a low sun over a salt flat");
    expect(absent).toHaveTextContent("No provenance recorded");

    // The styling difference IS the D-07 mechanism, not decoration.
    expect(populated.className).toContain("font-mono");
    expect(populated.className).not.toContain("italic");
    expect(absent.className).toContain("italic");
    expect(absent.className).toContain("text-muted-foreground");
    expect(populated.className).not.toBe(absent.className);
  });

  test("a fully provenance-absent row renders the sentinel in every recipe field, never a blank", () => {
    render(
      <MediaDetailSheet
        row={makeDetailRow({
          hasProvenance: false,
          prompt: undefined,
          model: undefined,
          provider: undefined,
        })}
        open
        onOpenChange={vi.fn()}
      />
    );
    for (const field of ["prompt", "model", "provider", "style", "project", "params"]) {
      const el = screen.getByTestId(`studio-detail-field-${field}`);
      expect(el).toHaveTextContent("No provenance recorded");
      expect(el.className).toContain("italic");
    }
  });
});

describe("MediaDetailSheet — Copy Recipe disabled state", () => {
  test("provenance-absent disables the button and carries the reason copy; CONTROL: provenance-bearing enables it", () => {
    render(
      <MediaDetailSheet
        row={makeDetailRow({
          hasProvenance: false,
          prompt: undefined,
          model: undefined,
          provider: undefined,
        })}
        open
        onOpenChange={vi.fn()}
      />
    );
    const disabledButton = screen.getByTestId("studio-detail-copy-recipe");
    expect(disabledButton).toBeDisabled();
    // A `disabled` button is neither hoverable-by-keyboard nor focusable, so
    // the Radix tooltip alone would leave the reason unreachable for anyone
    // not holding a mouse. The same copy is wired as the button's accessible
    // description, which is what this asserts.
    expect(disabledButton).toHaveAttribute(
      "aria-describedby",
      "studio-detail-copy-recipe-reason"
    );
    expect(
      screen.getByTestId("studio-detail-copy-recipe-reason")
    ).toHaveTextContent(NO_RECIPE_TOOLTIP_COPY);
    // The pointer affordance exists too — the wrapper the Radix trigger sits
    // on, since the disabled button itself swallows pointer events.
    expect(
      screen.getByTestId("studio-detail-copy-recipe-wrap")
    ).toBeInTheDocument();

    cleanup();

    // CONTROL: without the control this test would pass against a component
    // that disabled Copy Recipe unconditionally.
    render(<MediaDetailSheet row={makeDetailRow()} open onOpenChange={vi.fn()} />);
    expect(screen.getByTestId("studio-detail-copy-recipe")).toBeEnabled();
    expect(
      screen.queryByTestId("studio-detail-copy-recipe-wrap")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("studio-detail-copy-recipe-reason")
    ).not.toBeInTheDocument();
  });
});

describe("MediaDetailSheet — D-02: the Sheet is not a lightbox", () => {
  test("the rendered thumbnail src is thumbnailUrl and absPath appears only as text", () => {
    const row = makeDetailRow();
    render(<MediaDetailSheet row={row} open onOpenChange={vi.fn()} />);
    const img = screen.getByTestId("studio-detail-thumb") as HTMLImageElement;
    expect(img.src).toBe(row.thumbnailUrl);
    expect(screen.getByTestId("studio-detail-abspath")).toHaveTextContent(
      "media-vault"
    );
    // No anchor or image anywhere points at the original file.
    for (const el of Array.from(document.querySelectorAll("img, a"))) {
      const target = el.getAttribute("src") ?? el.getAttribute("href") ?? "";
      expect(target).not.toContain("media-vault");
    }
  });

  test("a null thumbnailUrl renders the fallback, never a broken <img>", () => {
    render(
      <MediaDetailSheet
        row={makeDetailRow({ thumbnailUrl: null })}
        open
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.getByTestId("studio-detail-fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("studio-detail-thumb")).not.toBeInTheDocument();
  });
});

describe("MediaDetailSheet — the trash action swap (D-08)", () => {
  test("a gallery row offers Move to Trash and no Restore; CONTROL: a trash row inverts exactly that", () => {
    render(<MediaDetailSheet row={makeDetailRow()} open onOpenChange={vi.fn()} />);
    expect(screen.getByTestId("studio-detail-trash")).toBeInTheDocument();
    expect(screen.queryByTestId("studio-detail-restore")).not.toBeInTheDocument();

    cleanup();

    render(
      <MediaDetailSheet
        row={makeDetailRow({ deletedAt: 5000, daysUntilPurge: 12 })}
        open
        trashVariant
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.getByTestId("studio-detail-restore")).toBeInTheDocument();
    expect(screen.queryByTestId("studio-detail-trash")).not.toBeInTheDocument();
  });

  test("Move to Trash closes the Sheet with no confirmation step in between", () => {
    const onOpenChange = vi.fn();
    render(<MediaDetailSheet row={makeDetailRow()} open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByTestId("studio-detail-trash"));
    // No modal appears and nothing else must be clicked first — the click
    // itself is the whole interaction (the 30-day Trash is the safety net).
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

describe("Studio Gallery — D-07's control pair at CARD level", () => {
  test("a grid holding one provenance-absent and one provenance-bearing row shows EXACTLY ONE badge", () => {
    // "At least one" would pass against a component that badged everything.
    h.queryResult = {
      rows: [
        makeCardRow({ _id: "complete", hasProvenance: true }),
        makeCardRow({ _id: "no-prov", hasProvenance: false }),
      ],
      cap: 500,
    };
    render(<Studio />);
    expect(screen.getAllByText("No provenance recorded")).toHaveLength(1);
    expect(
      screen.getByTestId("studio-media-provenance-badge-no-prov")
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("studio-media-provenance-badge-complete")
    ).not.toBeInTheDocument();
  });
});

describe("MediaCard — thumbnail fallback and the audio placeholder are distinguishable", () => {
  test("null thumbnailUrl falls back and stays clickable/star-able; CONTROL: a real URL renders an <img>", () => {
    const onOpen = vi.fn();
    const onToggleStar = vi.fn();
    render(
      <MediaCard
        row={makeCardRow({ thumbnailUrl: null })}
        onOpen={onOpen}
        onToggleStar={onToggleStar}
      />
    );
    expect(screen.getByText("Thumbnail unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Thumbnail unavailable"));
    expect(onOpen).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("studio-media-star-c1"));
    expect(onToggleStar).toHaveBeenCalledTimes(1);

    cleanup();

    render(<MediaCard row={makeCardRow()} onOpen={vi.fn()} onToggleStar={vi.fn()} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.queryByText("Thumbnail unavailable")).not.toBeInTheDocument();
  });

  test("firing the image's onError replaces it with the fallback", () => {
    render(<MediaCard row={makeCardRow()} onOpen={vi.fn()} onToggleStar={vi.fn()} />);
    expect(screen.queryByText("Thumbnail unavailable")).not.toBeInTheDocument();
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByText("Thumbnail unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  test("the audio placeholder is border-SOLID while the broken-thumbnail state is border-DASHED — the two must not read alike", () => {
    render(
      <>
        <MediaCard
          row={makeCardRow({ _id: "aud", mediaType: "audio", thumbnailUrl: null })}
          onOpen={vi.fn()}
          onToggleStar={vi.fn()}
        />
        <MediaCard
          row={makeCardRow({ _id: "brk", thumbnailUrl: null })}
          onOpen={vi.fn()}
          onToggleStar={vi.fn()}
        />
      </>
    );
    const audio = screen.getByTestId("studio-media-audio-aud");
    const broken = screen.getByTestId("studio-media-fallback-brk");
    expect(audio.className).toContain("border-solid");
    expect(audio.className).not.toContain("border-dashed");
    expect(broken.className).toContain("border-dashed");
    expect(broken.className).not.toContain("border-solid");
  });
});

describe("MediaCard — the Trash countdown's threshold", () => {
  test("daysUntilPurge 2 renders --status-error while 20 renders muted — both measured together", () => {
    render(
      <>
        <MediaCard
          row={makeCardRow({ _id: "soon", deletedAt: 1, daysUntilPurge: 2 })}
          trashVariant
          onOpen={vi.fn()}
          onToggleStar={vi.fn()}
        />
        <MediaCard
          row={makeCardRow({ _id: "later", deletedAt: 1, daysUntilPurge: 20 })}
          trashVariant
          onOpen={vi.fn()}
          onToggleStar={vi.fn()}
        />
      </>
    );
    const soon = screen.getByTestId("studio-media-purge-caption-soon");
    const later = screen.getByTestId("studio-media-purge-caption-later");

    expect(soon).toHaveTextContent("Deletes automatically in 2 days");
    expect(later).toHaveTextContent("Deletes automatically in 20 days");
    expect(soon.className).toContain("text-[var(--status-error)]");
    expect(later.className).not.toContain("text-[var(--status-error)]");
    expect(later.className).toContain("text-muted-foreground");
  });
});

describe("ModelsPanel — recipeMd is inert as HTML (T-118-05)", () => {
  const XSS_PAYLOAD = '<img src=x onerror=alert(1)>';

  test("an HTML payload in recipeMd renders as literal text and creates ZERO img elements", () => {
    h.queryResult = [
      {
        _id: "mm1",
        slug: "flux",
        name: "FLUX 1.1 Pro",
        type: "image",
        provider: "replicate",
        recipeMd: `use ${XSS_PAYLOAD} carefully`,
        enabled: true,
      },
    ];
    render(<ModelsPanel />);
    // Default COLLAPSED — the content is not in the DOM until opened, which
    // is itself the panel's spec'd initial state.
    expect(screen.queryByTestId("studio-model-recipe-mm1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("studio-models-trigger"));

    const pre = screen.getByTestId("studio-model-recipe-mm1");
    // Asserted FIRST because this is the assertion that actually guards the
    // rule: the payload never became an element. A source grep for
    // dangerouslySetInnerHTML is the weaker secondary check.
    expect(document.querySelectorAll("img")).toHaveLength(0);
    expect(pre.innerHTML).not.toContain("<img");
    expect(pre).toHaveTextContent(XSS_PAYLOAD);
    expect(pre.className).toContain("font-mono");
  });
});

describe("Styles and Models panels — read-only (D-12), default collapsed", () => {
  test("neither panel renders any create/edit/save control once opened", () => {
    h.queryResult = [
      {
        _id: "mm1",
        slug: "flux",
        name: "FLUX 1.1 Pro",
        type: "image",
        provider: "replicate",
        recipeMd: "MODEL_API_KEY",
        docsUrl: "https://example.test/docs",
        enabled: true,
      },
    ];
    render(<ModelsPanel />);
    fireEvent.click(screen.getByTestId("studio-models-trigger"));
    expect(screen.getByTestId("studio-model-card-mm1")).toBeInTheDocument();
    expect(
      screen.queryAllByRole("button", {
        name: /create|new|add|edit|save|enable|disable|delete/i,
      })
    ).toHaveLength(0);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    cleanup();

    h.queryResult = [
      { _id: "ms1", slug: "noir", name: "Noir", thumbnailUrl: null },
    ];
    render(<StylesPanel />);
    // CONTROL for the "default collapsed" claim: the grid is absent before
    // the trigger is clicked and present after.
    expect(screen.queryByTestId("studio-styles-grid")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("studio-styles-trigger"));
    expect(screen.getByTestId("studio-styles-grid")).toBeInTheDocument();
    expect(screen.getByTestId("studio-style-fallback-ms1")).toBeInTheDocument();
    expect(
      screen.queryAllByRole("button", {
        name: /create|new|add|edit|save|delete/i,
      })
    ).toHaveLength(0);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
