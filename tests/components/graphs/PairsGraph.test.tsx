import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import PairsGraph from '../../src/components/PairsGraph';
import { graphAssertions } from '../data/testHelpers';

describe('PairsGraph Component', () => {
  it('returns null when pairs data is empty', () => {
    const { container } = render(<PairsGraph pairsData={[]} />);
    graphAssertions.expectEmptyGraph(container);
  });

  it('renders SVG with bubbles for each pair', () => {
    const data = [
      { pair: 'Alice & Bob', count: 2 },
      { pair: 'Charlie & Diana', count: 1 },
    ];
    render(<PairsGraph pairsData={data} />);

    graphAssertions.expectSvgRendered();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('displays count for each pair', () => {
    const data = [
      { pair: 'Alice & Bob', count: 2 },
      { pair: 'Charlie & Diana', count: 3 },
    ];
    render(<PairsGraph pairsData={data} />);

    const svg = graphAssertions.expectSvgRendered();
    expect(svg.textContent).toContain('2');
    expect(svg.textContent).toContain('3');
  });

  it('renders legend with color indicators', () => {
    const data = [{ pair: 'Alice & Bob', count: 1 }];
    render(<PairsGraph pairsData={data} />);

    graphAssertions.expectLegendRendered();
  });

  it('applies different colors based on count', () => {
    const data = [
      { pair: 'A & B', count: 1 },
      { pair: 'C & D', count: 2 },
      { pair: 'E & F', count: 3 },
      { pair: 'G & H', count: 4 },
    ];
    render(<PairsGraph pairsData={data} />);

    graphAssertions.expectAllCountColors();
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

    graphAssertions.expectGridLayout(4);
  });

  it('renders outer glow circles for bubbles', () => {
    const data = [{ pair: 'Alice & Bob', count: 1 }];
    render(<PairsGraph pairsData={data} />);

    graphAssertions.expectGlowCircle();
  });

  it('scales bubble size based on count relative to max', () => {
    const data = [
      { pair: 'A & B', count: 1 },
      { pair: 'C & D', count: 5 },
    ];
    render(<PairsGraph pairsData={data} />);

    const mainCircles = graphAssertions.getNodeCircles();
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
