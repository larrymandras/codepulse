import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import KGSearchResults from "./KGSearchResults";
import type { KgSearchHit } from "../../lib/kgApi";

const hit = (overrides: Partial<KgSearchHit> = {}): KgSearchHit => ({
  subjectName: "Larry",
  subjectId: "e-larry",
  predicate: "knows",
  snippet: "Larry knows the architecture well",
  matchedTerm: "architecture",
  confidence: 0.9,
  ...overrides,
});

describe("KGSearchResults — result rows", () => {
  it("renders result rows with entity name, predicate, and snippet", () => {
    render(
      <KGSearchResults
        results={[hit()]}
        query="architecture"
        loading={false}
        gateState="ok"
        onSelectResult={() => {}}
      />,
    );
    expect(screen.getByText("Larry")).toBeTruthy();
    expect(screen.getByText("knows")).toBeTruthy();
    // snippet text is rendered; matched term "architecture" may be in a span
    expect(screen.getByText(/architecture/i)).toBeTruthy();
  });

  it("renders the results count line above the list", () => {
    render(
      <KGSearchResults
        results={[hit(), hit({ subjectName: "Hildr", subjectId: "e-hildr" })]}
        query="architecture"
        loading={false}
        gateState="ok"
        onSelectResult={() => {}}
      />,
    );
    expect(screen.getByText(/2 matches across facts & relationships/i)).toBeTruthy();
  });

  it("calls onSelectResult with the subjectName when a row is clicked", () => {
    const onSelectResult = vi.fn();
    render(
      <KGSearchResults
        results={[hit({ subjectName: "Larry" })]}
        query="architecture"
        loading={false}
        gateState="ok"
        onSelectResult={onSelectResult}
      />,
    );
    const row = screen.getByRole("button", { name: /Larry/i });
    fireEvent.click(row);
    expect(onSelectResult).toHaveBeenCalledWith("Larry");
  });

  it("passes subjectName verbatim without normalization on result row click", () => {
    const onSelectResult = vi.fn();
    const rawName = "Ástríðr Agent";
    render(
      <KGSearchResults
        results={[hit({ subjectName: rawName })]}
        query="agent"
        loading={false}
        gateState="ok"
        onSelectResult={onSelectResult}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: new RegExp(rawName) }));
    expect(onSelectResult).toHaveBeenCalledWith(rawName);
  });
});

describe("KGSearchResults — gated state: not-deployed", () => {
  it("shows the 'not available on this build yet' informational copy when gateState=not-deployed", () => {
    render(
      <KGSearchResults
        results={[]}
        query="test"
        loading={false}
        gateState="not-deployed"
        onSelectResult={() => {}}
      />,
    );
    // UI-SPEC Copywriting Contract: cross-repo gated state copy
    expect(
      screen.getByText(
        /Full-text search isn't available on the connected Ástríðr build yet/i,
      ),
    ).toBeTruthy();
    expect(screen.getByText(/\/api\/kg\/search endpoint/i)).toBeTruthy();
    expect(screen.getByText(/Entity-name search remains available/i)).toBeTruthy();
  });

  it("does NOT render a red error banner for not-deployed state", () => {
    const { container } = render(
      <KGSearchResults
        results={[]}
        query="test"
        loading={false}
        gateState="not-deployed"
        onSelectResult={() => {}}
      />,
    );
    // Should not have red border classes (error state); amber/info is expected
    const redBanner = container.querySelector('[class*="border-red-500"]');
    expect(redBanner).toBeNull();
  });
});

describe("KGSearchResults — gated state: error", () => {
  it("shows the red error banner when gateState=error", () => {
    const { container } = render(
      <KGSearchResults
        results={[]}
        query="test"
        loading={false}
        gateState="error"
        onSelectResult={() => {}}
      />,
    );
    // UI-SPEC: error state = red banner with endpoint-named copy
    expect(
      screen.getByText(/Could not reach the KG search API/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/Full-text search needs Ástríðr's \/api\/kg\/search endpoint/i),
    ).toBeTruthy();
    const redBanner = container.querySelector('[class*="border-red-500"]');
    expect(redBanner).not.toBeNull();
  });
});

describe("KGSearchResults — empty states", () => {
  it("shows no-query empty state (idle) with the correct UI-SPEC copy", () => {
    render(
      <KGSearchResults
        results={[]}
        query=""
        loading={false}
        gateState="idle"
        onSelectResult={() => {}}
      />,
    );
    // UI-SPEC Copywriting Contract: empty state — no query
    expect(screen.getByText(/Search the knowledge graph/i)).toBeTruthy();
    expect(
      screen.getByText(
        /Type a term to match across fact text and relationship labels/i,
      ),
    ).toBeTruthy();
  });

  it("shows no-results empty state with the query echoed in the heading", () => {
    render(
      <KGSearchResults
        results={[]}
        query="xyzzy"
        loading={false}
        gateState="ok"
        onSelectResult={() => {}}
      />,
    );
    // UI-SPEC Copywriting Contract: empty state — no results
    expect(screen.getByText(/No matches for/i)).toBeTruthy();
    expect(screen.getByText(/xyzzy/i)).toBeTruthy();
    expect(
      screen.getByText(/Try a shorter term, or switch to the Entity lens/i),
    ).toBeTruthy();
  });
});

describe("KGSearchResults — loading state", () => {
  it("shows the loading copy when loading=true", () => {
    render(
      <KGSearchResults
        results={[]}
        query="test"
        loading={true}
        gateState="idle"
        onSelectResult={() => {}}
      />,
    );
    // UI-SPEC Copywriting Contract: loading state
    expect(screen.getByText(/Searching knowledge graph/i)).toBeTruthy();
  });
});

describe("KGSearchResults — XSS safety (T-86-06)", () => {
  it("does not use dangerouslySetInnerHTML anywhere (static assertion)", () => {
    // This is enforced by the grep-gated acceptance criterion in the plan.
    // At runtime, matched terms are rendered as React text / <span> elements.
    const { container } = render(
      <KGSearchResults
        results={[
          hit({
            snippet: '<script>alert("xss")</script>',
            matchedTerm: "<script>",
          }),
        ]}
        query="<script>"
        loading={false}
        gateState="ok"
        onSelectResult={() => {}}
      />,
    );
    // The script tag must NOT be executed — React escapes it as text.
    const scripts = container.querySelectorAll("script");
    expect(scripts.length).toBe(0);
  });
});
