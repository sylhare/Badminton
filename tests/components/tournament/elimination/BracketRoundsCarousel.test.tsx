import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EliminationBracket } from '../../../../src/components/tournament/elimination/EliminationBracket';
import { EliminationTournament } from '../../../../src/tournament/EliminationTournament';
import type { TournamentTeam } from '../../../../src/tournament/types';
import { createMockPlayer } from '../../../data/testFactories';

function makeTeams(ids: string[]): TournamentTeam[] {
  return ids.map(id => ({ id, players: [createMockPlayer({ id: `${id}-p0`, name: id })] }));
}

/** Force useIsMobile to report a mobile viewport. */
function mockMobileViewport() {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
}

describe('EliminationBracket (mobile carousel)', () => {
  let onMatchResult: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onMatchResult = vi.fn();
    mockMobileViewport();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the carousel instead of the desktop tree on mobile', () => {
    const t = EliminationTournament.create('singles').start(makeTeams(['A', 'B', 'C', 'D']), 4);
    render(<EliminationBracket tournament={t} onMatchResult={onMatchResult} />);
    expect(screen.getAllByTestId('bracket-carousel').length).toBeGreaterThan(0);
    expect(document.querySelector('.bracket-tree')).toBeNull();
  });

  it('renders one snap page per round within the winners bracket', () => {
    const t = EliminationTournament.create('singles').start(makeTeams(['A', 'B', 'C', 'D']), 4);
    render(<EliminationBracket tournament={t} onMatchResult={onMatchResult} />);
    const wb = within(screen.getByTestId('wb-section'));
    expect(wb.getByTestId('bracket-carousel-page-1')).toBeInTheDocument();
    expect(wb.getByTestId('bracket-carousel-page-2')).toBeInTheDocument();
    expect(wb.queryByTestId('bracket-carousel-page-3')).not.toBeInTheDocument();
  });

  it('shows round labels as page headers', () => {
    const t = EliminationTournament.create('singles').start(makeTeams(['A', 'B', 'C', 'D']), 4);
    render(<EliminationBracket tournament={t} onMatchResult={onMatchResult} />);
    const wb = within(screen.getByTestId('wb-section'));
    expect(wb.getByTestId('bracket-round-label-Semi-Final')).toBeInTheDocument();
    expect(wb.getByTestId('bracket-round-label-Final')).toBeInTheDocument();
  });

  it('clicking a team still opens the score modal', async () => {
    const user = userEvent.setup();
    const t = EliminationTournament.create('singles').start(makeTeams(['A', 'B', 'C', 'D']), 4);
    render(<EliminationBracket tournament={t} onMatchResult={onMatchResult} />);

    const firstR1Team = screen.getAllByTestId(/^bracket-team-1-/)[0];
    await user.click(firstR1Team);

    expect(screen.getByTestId('score-input-modal')).toBeInTheDocument();
  });
});
