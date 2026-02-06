import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import TeammateGraph from '../../src/components/TeammateGraph';
import {
  createMockGetPlayerName,
  createLongNameGetter,
  GRAPH_COLORS,
} from '../data/testFactories';
import { graphAssertions } from '../data/testHelpers';

describe('TeammateGraph Component', () => {
  const mockGetPlayerName = createMockGetPlayerName();

  beforeEach(() => {
    mockGetPlayerName.mockClear();
  });

  it('returns null when teammate data is empty', () => {
    const { container } = render(
      <TeammateGraph teammateData={{}} getPlayerName={mockGetPlayerName} />,
    );
    graphAssertions.expectEmptyGraph(container);
  });

  it('returns null when all counts are zero', () => {
    const data = { '1|2': 0, '2|3': 0 };
    const { container } = render(
      <TeammateGraph teammateData={data} getPlayerName={mockGetPlayerName} />,
    );
    graphAssertions.expectEmptyGraph(container);
  });

  it('renders SVG with nodes for each unique player', () => {
    const data = { '1|2': 1, '2|3': 2 };
    render(<TeammateGraph teammateData={data} getPlayerName={mockGetPlayerName} />);

    graphAssertions.expectSvgRendered();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charl…')).toBeInTheDocument();
  });

  it('renders edges between connected players', () => {
    const data = { '1|2': 1 };
    render(<TeammateGraph teammateData={data} getPlayerName={mockGetPlayerName} />);

    const lines = graphAssertions.getEdges();
    expect(lines.length).toBe(1);
  });

  it('renders multiple edges for multiple pairs', () => {
    const data = { '1|2': 1, '2|3': 2, '1|3': 1 };
    render(<TeammateGraph teammateData={data} getPlayerName={mockGetPlayerName} />);

    const lines = graphAssertions.getEdges();
    expect(lines.length).toBe(3);
  });

  it('renders legend with color indicators', () => {
    const data = { '1|2': 1 };
    render(<TeammateGraph teammateData={data} getPlayerName={mockGetPlayerName} />);

    expect(screen.getByText('1×')).toBeInTheDocument();
    expect(screen.getByText('2×')).toBeInTheDocument();
    expect(screen.getByText('3×')).toBeInTheDocument();
    expect(screen.getByText('4×+')).toBeInTheDocument();
  });

  it('applies different stroke colors based on count', () => {
    const data = { '1|2': 1, '2|3': 2, '3|4': 4 };
    render(<TeammateGraph teammateData={data} getPlayerName={mockGetPlayerName} />);

    const lines = graphAssertions.getEdges();
    const strokes = Array.from(lines).map(line => line.getAttribute('stroke'));

    expect(strokes).toContain(GRAPH_COLORS.count1);
    expect(strokes).toContain(GRAPH_COLORS.count2);
    expect(strokes).toContain(GRAPH_COLORS.count4Plus);
  });

  it('uses purple node stroke for opponent variant', () => {
    const data = { '1|2': 1 };
    render(
      <TeammateGraph
        teammateData={data}
        getPlayerName={mockGetPlayerName}
        variant="opponent"
      />,
    );

    const nodeCircles = graphAssertions.getNodeCircles();
    expect(nodeCircles[0]?.getAttribute('stroke')).toBe(GRAPH_COLORS.opponentStroke);
  });

  it('uses blue node stroke for teammate variant', () => {
    const data = { '1|2': 1 };
    render(
      <TeammateGraph
        teammateData={data}
        getPlayerName={mockGetPlayerName}
        variant="teammate"
      />,
    );

    const nodeCircles = graphAssertions.getNodeCircles();
    expect(nodeCircles[0]?.getAttribute('stroke')).toBe(GRAPH_COLORS.teammateStroke);
  });

  it('truncates long player names', () => {
    const data = { '1|2': 1 };
    render(<TeammateGraph teammateData={data} getPlayerName={createLongNameGetter()} />);

    expect(screen.getByText('Alexa…')).toBeInTheDocument();
  });

  it('calls getPlayerName for each unique player', () => {
    const data = { '1|2': 1, '2|3': 2 };
    render(<TeammateGraph teammateData={data} getPlayerName={mockGetPlayerName} />);

    expect(mockGetPlayerName).toHaveBeenCalledWith('1');
    expect(mockGetPlayerName).toHaveBeenCalledWith('2');
    expect(mockGetPlayerName).toHaveBeenCalledWith('3');
  });

  it('scales canvas size based on number of players', () => {
    const smallData = { '1|2': 1 };
    const { rerender } = render(
      <TeammateGraph teammateData={smallData} getPlayerName={mockGetPlayerName} />,
    );
    const smallSvg = document.querySelector('svg');
    const smallWidth = smallSvg?.getAttribute('width');

    const largeData = {
      '1|2': 1, '2|3': 1, '3|4': 1, '4|5': 1,
      '5|6': 1, '6|7': 1, '7|8': 1, '8|9': 1,
    };
    const largeNameGetter = (id: string) => `Player${id}`;
    rerender(
      <TeammateGraph teammateData={largeData} getPlayerName={largeNameGetter} />,
    );
    const largeSvg = document.querySelector('svg');
    const largeWidth = largeSvg?.getAttribute('width');

    expect(Number(largeWidth)).toBeGreaterThanOrEqual(Number(smallWidth));
  });
});
