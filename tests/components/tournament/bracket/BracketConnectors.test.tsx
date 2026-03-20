import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { BracketConnectors } from '../../../../src/components/tournament/bracket/BracketConnectors';
import { CN } from '../../../../src/tournament/bracket/types';

describe('BracketConnectors', () => {
  it('renders one <g> group for 2 fromTops → 1 toTop', () => {
    const { container } = render(
      <svg>
        <BracketConnectors fromTops={[0, 76]} toTops={[38]} height={200} left={0} />
      </svg>,
    );

    const groups = container.querySelectorAll('g');
    expect(groups).toHaveLength(1);
  });

  it('each group has 4 lines', () => {
    const { container } = render(
      <svg>
        <BracketConnectors fromTops={[0, 76]} toTops={[38]} height={200} left={0} />
      </svg>,
    );

    const lines = container.querySelectorAll('g')[0].querySelectorAll('line');
    expect(lines).toHaveLength(4);
  });

  it('renders two <g> groups for 4 fromTops → 2 toTops', () => {
    const { container } = render(
      <svg>
        <BracketConnectors fromTops={[0, 76, 152, 228]} toTops={[38, 190]} height={400} left={0} />
      </svg>,
    );

    const groups = container.querySelectorAll('g');
    expect(groups).toHaveLength(2);
  });

  it('SVG has CN as width in style', () => {
    const { container } = render(
      <svg>
        <BracketConnectors fromTops={[0, 76]} toTops={[38]} height={200} left={0} />
      </svg>,
    );

    const innerSvg = container.querySelector('.bracket-connectors') as HTMLElement | null;
    expect(innerSvg).not.toBeNull();
    expect(innerSvg?.style.width).toBe(`${CN}px`);
  });

  it('SVG height prop is applied via style', () => {
    const { container } = render(
      <svg>
        <BracketConnectors fromTops={[0, 76]} toTops={[38]} height={300} left={0} />
      </svg>,
    );

    const innerSvg = container.querySelector('.bracket-connectors') as HTMLElement | null;
    expect(innerSvg?.style.height).toBe('300px');
  });
});
