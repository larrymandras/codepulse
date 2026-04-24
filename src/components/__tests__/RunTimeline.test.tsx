import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RunTimeline } from '../RunTimeline';

// ─── Fixture blocks ────────────────────────────────────────────────────────────

const round1Blocks = [
  { type: 'thinking', text: 'Let me think about this...' },
  { type: 'tool_use', name: 'search', arguments: { query: 'test' }, tool_call_id: 'tc_001' },
  { type: 'tool_result', tool_call_id: 'tc_001', result: 'found results' },
  { type: 'text', text: 'Here is what I found.' },
];

const round2Blocks = [
  { type: 'thinking', text: 'Now let me process...' },
  { type: 'tool_use', name: 'write_file', arguments: { path: 'out.txt' }, tool_call_id: 'tc_002' },
  { type: 'tool_result', tool_call_id: 'tc_002', result: 'written' },
];

const twoRoundBlocks = [...round1Blocks, ...round2Blocks];

describe('RunTimeline', () => {
  it('groups blocks into rounds — "thinking" starts a new round', () => {
    render(<RunTimeline blocks={twoRoundBlocks} streaming={false} />);
    expect(screen.getByText(/Round 1/)).toBeInTheDocument();
    expect(screen.getByText(/Round 2/)).toBeInTheDocument();
  });

  it('renders each round as a collapsible details/summary section', () => {
    const { container } = render(<RunTimeline blocks={twoRoundBlocks} streaming={false} />);
    const detailsElements = container.querySelectorAll('details');
    expect(detailsElements.length).toBe(2);
    // All details elements have summary children
    detailsElements.forEach((el) => {
      expect(el.querySelector('summary')).not.toBeNull();
    });
  });

  it('round header shows round index and tool call count', () => {
    render(<RunTimeline blocks={twoRoundBlocks} streaming={false} />);
    // Both rounds have 1 tool_use each — verify at least one count label exists
    const toolCallCounts = screen.getAllByText(/1 tool call/);
    expect(toolCallCounts.length).toBeGreaterThanOrEqual(1);
    // Verify round labels exist
    expect(screen.getByText(/Round 1/)).toBeInTheDocument();
    expect(screen.getByText(/Round 2/)).toBeInTheDocument();
  });

  it('completed rounds (not last during streaming) are collapsed by default', () => {
    const { container } = render(<RunTimeline blocks={twoRoundBlocks} streaming={true} />);
    const detailsElements = container.querySelectorAll('details');
    // Round 1 (completed) should NOT have open attribute
    expect(detailsElements[0].hasAttribute('open')).toBe(false);
  });

  it('active (last) round during streaming is expanded', () => {
    const { container } = render(<RunTimeline blocks={twoRoundBlocks} streaming={true} />);
    const detailsElements = container.querySelectorAll('details');
    // Last round should have open attribute
    expect(detailsElements[detailsElements.length - 1].hasAttribute('open')).toBe(true);
  });

  it('active round header has amber left stripe (border-l-4 with --status-warn)', () => {
    const { container } = render(<RunTimeline blocks={twoRoundBlocks} streaming={true} />);
    const detailsElements = container.querySelectorAll('details');
    const lastDetails = detailsElements[detailsElements.length - 1];
    const summary = lastDetails.querySelector('summary');
    expect(summary?.className).toContain('border-(--status-warn)');
  });

  it('shows thinking indicator when streaming=true and no blocks', () => {
    render(<RunTimeline blocks={[]} streaming={true} />);
    expect(screen.getByText(/Thinking/i)).toBeInTheDocument();
  });

  it("counts tool_call blocks (not just tool_use) in round header", () => {
    const blocks = [
      { type: "thinking", round_num: 1, thinking_text: "thinking" },
      { type: "tool_call", tool_name: "search", arguments: {}, status: "success" },
      { type: "tool_call", tool_name: "write", arguments: {}, status: "success" },
    ];
    render(<RunTimeline blocks={blocks} streaming={false} />);
    expect(screen.getByText(/2 tool calls/)).toBeInTheDocument();
  });
});
