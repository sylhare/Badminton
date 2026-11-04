import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import LevelHistoryGraph from '../../../src/components/graphs/LevelHistoryGraph';
import { createMockGetPlayerName } from '../../data/testFactories';

describe('LevelHistoryGraph Component', () => {
  const mockGetPlayerName = createMockGetPlayerName();

  beforeEach(() => {
    mockGetPlayerName.mockClear();
  });

  it('returns null when level history is empty', () => {
    const { container } = render(
      <LevelHistoryGraph levelHistory={{}} getPlayerName={mockGetPlayerName} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders SVG with translated aria-label and axis label', () => {
    const history = {
      '1': [10, 12, 14],
      '2': [8, 9, 11],
    };

    render(<LevelHistoryGraph levelHistory={history} getPlayerName={mockGetPlayerName} />);

    const svg = screen.getByLabelText('Level progression chart');
    expect(svg).toBeInTheDocument();
    expect(screen.getByText('Round')).toBeInTheDocument();
    expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Bob').length).toBeGreaterThanOrEqual(1);
  });
});
