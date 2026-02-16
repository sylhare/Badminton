import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import StatsPage from '../../src/pages/StatsPage';
import * as storageUtils from '../../src/utils/storageUtils';

const { mockLoadState, mockPrepareStateForSaving, mockOnStateChange } = vi.hoisted(() => ({
  mockLoadState: vi.fn(),
  mockPrepareStateForSaving: vi.fn(),
  mockOnStateChange: vi.fn(() => vi.fn()),
}));

vi.mock('../../src/engines/engineSelector', () => ({
  engine: () => ({
    loadState: mockLoadState,
    prepareStateForSaving: mockPrepareStateForSaving,
    onStateChange: mockOnStateChange,
    getName: vi.fn(() => 'Test Engine'),
    getDescription: vi.fn(() => 'Test engine description'),
  }),
  getEngineType: vi.fn(() => 'sa'),
}));

vi.mock('../../src/utils/storageUtils', () => ({
  loadAppState: vi.fn(),
  loadCourtEngineState: vi.fn(),
  saveCourtEngineState: vi.fn(),
  saveAppState: vi.fn(),
}));

describe('StatsPage Component', () => {
  const mockPlayers = [
    { id: '1', name: 'Alice', isPresent: true },
    { id: '2', name: 'Bob', isPresent: true },
    { id: '3', name: 'Charlie', isPresent: true },
    { id: '4', name: 'Diana', isPresent: true },
    { id: '5', name: 'Eve', isPresent: true },
  ];

  const mockEngineState = {
    engineType: 'sa' as const,
    benchCountMap: { '1': 2, '2': 1, '3': 0 },
    teammateCountMap: { '1|2': 2, '2|3': 1, '3|4': 1 },
    opponentCountMap: { '1|3': 2, '2|4': 1 },
    singleCountMap: { '1': 1, '2': 2 },
    winCountMap: { '1': 3, '2': 1 },
    lossCountMap: { '1': 1, '2': 2 },
  };

  beforeEach(() => {
    mockPrepareStateForSaving.mockReturnValue(mockEngineState);
    vi.mocked(storageUtils.loadAppState).mockReturnValue({ players: mockPlayers });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page header', () => {
    render(<StatsPage />);

    expect(screen.getByText('Test Engine Diagnostics')).toBeInTheDocument();
    expect(screen.getByText('Test engine description')).toBeInTheDocument();
  });

  it('renders back to app link', () => {
    render(<StatsPage />);

    const backLink = screen.getByTestId('back-to-app');
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveTextContent('Back to App');
  });

  it('renders notebook links section', () => {
    render(<StatsPage />);

    expect(screen.getByText('📓 Analysis Notebooks')).toBeInTheDocument();
    expect(screen.getByTestId('algorithm-link')).toBeInTheDocument();
    expect(screen.getByTestId('engine-link')).toBeInTheDocument();
  });

  it('renders diagnostic sections when data exists', async () => {
    render(<StatsPage />);

    await waitFor(() => {
      expect(screen.getByText('🔍 Current Session Diagnostics')).toBeInTheDocument();
      expect(screen.getByText('🪑 Bench Distribution')).toBeInTheDocument();
      expect(screen.getByText('👥 Teammate Connections')).toBeInTheDocument();
      expect(screen.getByText('⚔️ Opponent Matchups')).toBeInTheDocument();
      expect(screen.getByText('🎯 Singles Matches')).toBeInTheDocument();
    });
  });

  it('shows no data message when engine state is empty', () => {
    mockPrepareStateForSaving.mockReturnValue(null);

    render(<StatsPage />);

    expect(screen.getByText('No session data yet. Start playing to see diagnostics!')).toBeInTheDocument();
    expect(screen.getByText('Start a Game →')).toBeInTheDocument();
  });

  it('displays total players count from engine state', async () => {
    render(<StatsPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Players')).toBeInTheDocument();
    });
  });

  it('loads engine state on mount', () => {
    render(<StatsPage />);

    expect(mockLoadState).toHaveBeenCalled();
    expect(mockPrepareStateForSaving).toHaveBeenCalled();
  });

  it('loads app state to get player names', () => {
    render(<StatsPage />);

    expect(storageUtils.loadAppState).toHaveBeenCalled();
  });

  it('subscribes to engine state changes', () => {
    render(<StatsPage />);

    expect(mockOnStateChange).toHaveBeenCalled();
  });

  it('renders bench distribution summary', async () => {
    render(<StatsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Never benched/)).toBeInTheDocument();
      expect(screen.getByText(/Benched once/)).toBeInTheDocument();
      expect(screen.getByText(/Benched multiple times/)).toBeInTheDocument();
      expect(screen.getByText(/Fairness score/)).toBeInTheDocument();
    });
  });

  it('renders collapsible sections with counts', async () => {
    render(<StatsPage />);

    await waitFor(() => {
      expect(screen.getByText(/View bench counts per player/)).toBeInTheDocument();
    });
  });

  it('displays footer with GitHub link', () => {
    render(<StatsPage />);

    expect(screen.getByText(/Have feedback/)).toBeInTheDocument();
    expect(screen.getByText('Let us know on GitHub')).toHaveAttribute(
      'href',
      'https://github.com/sylhare/Badminton/issues/new/choose',
    );
  });

  it('shows no issues message when no teammate pairings', async () => {
    mockPrepareStateForSaving.mockReturnValue({
      benchCountMap: { '1': 1 },
      teammateCountMap: {},
      opponentCountMap: {},
      singleCountMap: {},
      winCountMap: { '1': 1 },
      lossCountMap: {},
      lastUpdatedMap: {},
    });

    render(<StatsPage />);

    await waitFor(() => {
      expect(screen.getByText('✓ No teammate pairings recorded yet')).toBeInTheDocument();
    });
  });

  it('shows no issues message when no opponent matchups', async () => {
    mockPrepareStateForSaving.mockReturnValue({
      benchCountMap: { '1': 1 },
      teammateCountMap: { '1|2': 1 },
      opponentCountMap: {},
      singleCountMap: {},
      winCountMap: { '1': 1 },
      lossCountMap: {},
      lastUpdatedMap: {},
    });

    render(<StatsPage />);

    await waitFor(() => {
      expect(screen.getByText('✓ No opponent matchups recorded yet')).toBeInTheDocument();
    });
  });

  it('shows no singles message when no singles matches', async () => {
    mockPrepareStateForSaving.mockReturnValue({
      benchCountMap: { '1': 1 },
      teammateCountMap: { '1|2': 1 },
      opponentCountMap: { '1|3': 1 },
      singleCountMap: {},
      winCountMap: { '1': 1 },
      lossCountMap: {},
      lastUpdatedMap: {},
    });

    render(<StatsPage />);

    await waitFor(() => {
      expect(screen.getByText('No singles matches recorded')).toBeInTheDocument();
    });
  });

  describe('warnings', () => {
    it('does not show warnings section when there are no warnings', async () => {
      mockPrepareStateForSaving.mockReturnValue({
        benchCountMap: { '1': 1, '2': 1, '3': 1 },
        teammateCountMap: { '1|2': 1, '2|3': 1 },
        opponentCountMap: { '1|3': 1 },
        singleCountMap: { '1': 1 },
        winCountMap: { '1': 1 },
        lossCountMap: {},
        lastUpdatedMap: {},
      });

      render(<StatsPage />);

      await waitFor(() => {
        expect(screen.queryByText('⚠️ Warnings')).not.toBeInTheDocument();
      });
    });

    it('shows warnings section when bench imbalance is detected', async () => {
      mockPrepareStateForSaving.mockReturnValue({
        benchCountMap: { '1': 10, '2': 0, '3': 0, '4': 0, '5': 0 },
        teammateCountMap: { '1|2': 1 },
        opponentCountMap: {},
        singleCountMap: {},
        winCountMap: { '1': 5, '2': 5 },
        lossCountMap: {},
        lastUpdatedMap: {},
      });

      render(<StatsPage />);

      await waitFor(() => {
        expect(screen.getByText('⚠️ Warnings')).toBeInTheDocument();
        expect(screen.getByText(/Bench imbalance/)).toBeInTheDocument();
      });
    });
  });

  describe('diagnostics calculations', () => {
    it('calculates bench fairness score correctly', async () => {
      render(<StatsPage />);

      await waitFor(() => {
        const fairnessScore = screen.getByText(/lower is better/);
        expect(fairnessScore).toBeInTheDocument();
      });
    });

    it('displays repeated teammates in descending order by count', async () => {
      mockPrepareStateForSaving.mockReturnValue({
        benchCountMap: {},
        teammateCountMap: { '1|2': 3, '2|3': 5, '3|4': 2 },
        opponentCountMap: {},
        singleCountMap: {},
        winCountMap: {},
        lossCountMap: {},
        lastUpdatedMap: {},
      });

      render(<StatsPage />);

      await waitFor(() => {
        const repeatedPairs = screen.getByText('Repeated Pairs');
        expect(repeatedPairs).toBeInTheDocument();
      });
    });
  });
});
