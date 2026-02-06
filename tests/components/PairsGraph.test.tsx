import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import PairsGraph from '../../src/components/PairsGraph';

describe('PairsGraph Component', () => {
  it('returns null when pairs data is empty', () => {
    const { container } = render(<PairsGraph pairsData={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders SVG with bubbles for each pair', () => {
    const data = [
      { pair: 'Alice & Bob', count: 2 },
      { pair: 'Charlie & Diana', count: 1 },
    ];
    render(<PairsGraph pairsData={data} />);

    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('displays count for each pair', () => {
    const data = [
      { pair: 'Alice & Bob', count: 2 },
      { pair: 'Charlie & Diana', count: 3 },
    ];
    render(<PairsGraph pairsData={data} />);

    const svg = document.querySelector('svg');
    expect(svg?.textContent).toContain('2');
    expect(svg?.textContent).toContain('3');
  });

  it('renders legend with color indicators', () => {
    const data = [{ pair: 'Alice & Bob', count: 1 }];
    render(<PairsGraph pairsData={data} />);

    const legend = document.querySelector('.graph-legend');
    expect(legend).toBeInTheDocument();
    expect(legend?.textContent).toContain('1×');
    expect(legend?.textContent).toContain('2×');
    expect(legend?.textContent).toContain('3×');
    expect(legend?.textContent).toContain('4×+');
  });

  it('applies different colors based on count', () => {
    const data = [
      { pair: 'A & B', count: 1 },
      { pair: 'C & D', count: 2 },
      { pair: 'E & F', count: 3 },
      { pair: 'G & H', count: 4 },
    ];
    render(<PairsGraph pairsData={data} />);

    const circles = document.querySelectorAll('circle');
    const strokes = Array.from(circles)
      .filter(c => c.getAttribute('fill') === '#21262d')
      .map(c => c.getAttribute('stroke'));

    expect(strokes).toContain('#58a6ff'); // blue for 1
    expect(strokes).toContain('#d29922'); // yellow for 2
    expect(strokes).toContain('#f0883e'); // orange for 3
    expect(strokes).toContain('#f85149'); // red for 4+
  });

  it('truncates long player names in pairs', () => {
    const data = [{ pair: 'AlexanderTheGreat & BobTheBuilder', count: 1 }];
    render(<PairsGraph pairsData={data} />);

    expect(screen.getByText('Alexand…')).toBeInTheDocument();
    expect(screen.getByText('BobTheB…')).toBeInTheDocument();
  });

  it('handles vs separator for opponents', () => {
    const data = [{ pair: 'Alice vs Bob', count: 2 }];
    render(<PairsGraph pairsData={data} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders bubbles in a grid layout', () => {
    const data = [
      { pair: 'A & B', count: 1 },
      { pair: 'C & D', count: 1 },
      { pair: 'E & F', count: 1 },
      { pair: 'G & H', count: 1 },
    ];
    render(<PairsGraph pairsData={data} />);

    const groups = document.querySelectorAll('g');
    expect(groups.length).toBeGreaterThanOrEqual(4);
  });

  it('renders outer glow circles for bubbles', () => {
    const data = [{ pair: 'Alice & Bob', count: 1 }];
    render(<PairsGraph pairsData={data} />);

    const circles = document.querySelectorAll('circle');
    const glowCircle = Array.from(circles).find(c => c.getAttribute('fill') === 'none');
    expect(glowCircle).toBeInTheDocument();
  });

  it('scales bubble size based on count relative to max', () => {
    const data = [
      { pair: 'A & B', count: 1 },
      { pair: 'C & D', count: 5 },
    ];
    render(<PairsGraph pairsData={data} />);

    const mainCircles = Array.from(document.querySelectorAll('circle'))
      .filter(c => c.getAttribute('fill') === '#21262d');

    const radii = mainCircles.map(c => Number(c.getAttribute('r')));
    expect(radii.length).toBe(2);
    expect(Math.max(...radii)).toBeGreaterThan(Math.min(...radii));
  });

  it('displays two lines for pair names', () => {
    const data = [{ pair: 'Alice & Bob', count: 2 }];
    render(<PairsGraph pairsData={data} />);

    const textElements = document.querySelectorAll('text');
    const texts = Array.from(textElements).map(t => t.textContent);

    expect(texts).toContain('Alice');
    expect(texts).toContain('Bob');
  });
});
