import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import SinglesGraph from '../../src/components/SinglesGraph';
import { createMockGetPlayerName, createLongNameGetter } from '../data/testFactories';
import { graphAssertions } from '../data/testHelpers';

describe('SinglesGraph Component', () => {
  const mockGetPlayerName = createMockGetPlayerName();

  beforeEach(() => {
    mockGetPlayerName.mockClear();
  });

  it('returns null when singles data is empty', () => {
    const { container } = render(
      <SinglesGraph singlesData={{}} getPlayerName={mockGetPlayerName} />,
    );
    graphAssertions.expectEmptyGraph(container);
  });

  it('returns null when all counts are zero', () => {
    const data = { '1': 0, '2': 0 };
    const { container } = render(
      <SinglesGraph singlesData={data} getPlayerName={mockGetPlayerName} />,
    );
    graphAssertions.expectEmptyGraph(container);
  });

  it('renders SVG with bubbles for each player', () => {
    const data = { '1': 2, '2': 1 };
    render(<SinglesGraph singlesData={data} getPlayerName={mockGetPlayerName} />);

    graphAssertions.expectSvgRendered();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('displays count for each player', () => {
    const data = { '1': 2, '2': 3 };
    render(<SinglesGraph singlesData={data} getPlayerName={mockGetPlayerName} />);

    const svg = graphAssertions.expectSvgRendered();
    expect(svg.textContent).toContain('2');
    expect(svg.textContent).toContain('3');
  });

  it('renders legend with color indicators', () => {
    const data = { '1': 1 };
    render(<SinglesGraph singlesData={data} getPlayerName={mockGetPlayerName} />);

    graphAssertions.expectLegendRendered();
  });

  it('applies different colors based on count', () => {
    const data = { '1': 1, '2': 2, '3': 3, '4': 4 };
    render(<SinglesGraph singlesData={data} getPlayerName={mockGetPlayerName} />);

    graphAssertions.expectAllCountColors();
  });

  it('truncates long player names', () => {
    const data = { '1': 1, '2': 1 };
    render(<SinglesGraph singlesData={data} getPlayerName={createLongNameGetter()} />);

    expect(screen.getByText('Alexand…')).toBeInTheDocument();
  });

  it('calls getPlayerName for each player with count > 0', () => {
    const data = { '1': 1, '2': 2, '3': 0 };
    render(<SinglesGraph singlesData={data} getPlayerName={mockGetPlayerName} />);

    expect(mockGetPlayerName).toHaveBeenCalledWith('1');
    expect(mockGetPlayerName).toHaveBeenCalledWith('2');
    expect(mockGetPlayerName).not.toHaveBeenCalledWith('3');
  });

  it('renders bubbles in a grid layout', () => {
    const data = { '1': 1, '2': 1, '3': 1, '4': 1 };
    render(<SinglesGraph singlesData={data} getPlayerName={mockGetPlayerName} />);

    graphAssertions.expectGridLayout(4);
  });

  it('renders outer glow circles for bubbles', () => {
    const data = { '1': 1 };
    render(<SinglesGraph singlesData={data} getPlayerName={mockGetPlayerName} />);

    graphAssertions.expectGlowCircle();
  });

  it('sorts bubbles by count descending', () => {
    const data = { '1': 1, '2': 5, '3': 3 };
    render(<SinglesGraph singlesData={data} getPlayerName={mockGetPlayerName} />);

    const textElements = screen.getAllByText(/×$/);
    const counts = textElements.map(el => el.textContent);

    expect(counts[0]).toBe('5×');
  });
});
