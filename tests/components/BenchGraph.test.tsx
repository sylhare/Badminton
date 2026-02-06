import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import BenchGraph from '../../src/components/BenchGraph';

describe('BenchGraph Component', () => {
  const mockGetPlayerName = vi.fn((id: string) => {
    const names: Record<string, string> = {
      '1': 'Alice',
      '2': 'Bob',
      '3': 'Charlie',
      '4': 'Diana',
    };
    return names[id] || id;
  });

  beforeEach(() => {
    mockGetPlayerName.mockClear();
  });

  it('returns null when bench data is empty', () => {
    const { container } = render(
      <BenchGraph benchData={{}} getPlayerName={mockGetPlayerName} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when all counts are zero', () => {
    const data = { '1': 0, '2': 0 };
    const { container } = render(
      <BenchGraph benchData={data} getPlayerName={mockGetPlayerName} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders SVG with bubbles for each player', () => {
    const data = { '1': 2, '2': 1 };
    render(<BenchGraph benchData={data} getPlayerName={mockGetPlayerName} />);

    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('displays bench count for each player', () => {
    const data = { '1': 2, '2': 3 };
    render(<BenchGraph benchData={data} getPlayerName={mockGetPlayerName} />);

    const svg = document.querySelector('svg');
    expect(svg?.textContent).toContain('2');
    expect(svg?.textContent).toContain('3');
  });

  it('renders legend with color indicators', () => {
    const data = { '1': 1 };
    render(<BenchGraph benchData={data} getPlayerName={mockGetPlayerName} />);

    const legend = document.querySelector('.graph-legend');
    expect(legend).toBeInTheDocument();
    expect(legend?.textContent).toContain('1×');
    expect(legend?.textContent).toContain('2×');
    expect(legend?.textContent).toContain('3×');
    expect(legend?.textContent).toContain('4×+');
  });

  it('applies different colors based on count', () => {
    const data = { '1': 1, '2': 2, '3': 3, '4': 4 };
    render(<BenchGraph benchData={data} getPlayerName={mockGetPlayerName} />);

    const circles = document.querySelectorAll('circle');
    const strokes = Array.from(circles)
      .filter(c => c.getAttribute('fill') === '#21262d')
      .map(c => c.getAttribute('stroke'));

    expect(strokes).toContain('#58a6ff'); // blue for 1
    expect(strokes).toContain('#d29922'); // yellow for 2
    expect(strokes).toContain('#f0883e'); // orange for 3
    expect(strokes).toContain('#f85149'); // red for 4+
  });

  it('truncates long player names', () => {
    const longNameGetter = (id: string) => id === '1' ? 'AlexanderTheGreat' : 'Bob';
    const data = { '1': 1, '2': 1 };
    render(<BenchGraph benchData={data} getPlayerName={longNameGetter} />);

    expect(screen.getByText('Alexand…')).toBeInTheDocument();
  });

  it('calls getPlayerName for each player with count > 0', () => {
    const data = { '1': 1, '2': 2, '3': 0 };
    render(<BenchGraph benchData={data} getPlayerName={mockGetPlayerName} />);

    expect(mockGetPlayerName).toHaveBeenCalledWith('1');
    expect(mockGetPlayerName).toHaveBeenCalledWith('2');
    expect(mockGetPlayerName).not.toHaveBeenCalledWith('3');
  });

  it('renders bubbles in a grid layout', () => {
    const data = { '1': 1, '2': 1, '3': 1, '4': 1 };
    render(<BenchGraph benchData={data} getPlayerName={mockGetPlayerName} />);

    const groups = document.querySelectorAll('g');
    expect(groups.length).toBeGreaterThanOrEqual(4);
  });

  it('renders outer glow circles for bubbles', () => {
    const data = { '1': 1 };
    render(<BenchGraph benchData={data} getPlayerName={mockGetPlayerName} />);

    const circles = document.querySelectorAll('circle');
    const glowCircle = Array.from(circles).find(c => c.getAttribute('fill') === 'none');
    expect(glowCircle).toBeInTheDocument();
  });

  it('sorts bubbles by count descending', () => {
    const data = { '1': 1, '2': 5, '3': 3 };
    render(<BenchGraph benchData={data} getPlayerName={mockGetPlayerName} />);

    const textElements = screen.getAllByText(/×$/);
    const counts = textElements.map(el => el.textContent);

    expect(counts[0]).toBe('5×');
  });

  it('scales bubble size based on count relative to max', () => {
    const data = { '1': 1, '2': 5 };
    render(<BenchGraph benchData={data} getPlayerName={mockGetPlayerName} />);

    const mainCircles = Array.from(document.querySelectorAll('circle'))
      .filter(c => c.getAttribute('fill') === '#21262d');

    const radii = mainCircles.map(c => Number(c.getAttribute('r')));
    expect(radii.length).toBe(2);
    expect(Math.max(...radii)).toBeGreaterThan(Math.min(...radii));
  });
});
