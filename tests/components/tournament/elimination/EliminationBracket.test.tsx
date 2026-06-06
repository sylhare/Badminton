import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EliminationBracket } from '../../../../src/components/tournament/elimination/EliminationBracket';
import { EliminationTournament } from '../../../../src/tournament/EliminationTournament';
import type { TournamentTeam } from '../../../../src/tournament/types';
import { createMockPlayer } from '../../../data/testFactories';
import { playAllCBRounds, playFullTournament, playWBRound } from '../../../data/tournamentTestHelpers';

function makeTeam(id: string): TournamentTeam {
  return { id, players: [createMockPlayer({ id: `${id}-p0`, name: id })] };
}

function makeTeams(ids: string[]): TournamentTeam[] {
  return ids.map(makeTeam);
}

describe('EliminationBracket', () => {
  let onMatchResult: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onMatchResult = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('column headers', () => {
    it('shows "Final" header for 2 teams (1-round WB)', () => {
      const t = EliminationTournament.create('singles').start(makeTeams(['A', 'B']), 2);
      render(<EliminationBracket tournament={t} onMatchResult={onMatchResult} />);
      expect(screen.getByTestId('bracket-round-label-Final')).toBeInTheDocument();
    });

    it('shows "Semi Final" and "Final" headers for 4 teams', () => {
      const t = EliminationTournament.create('singles').start(makeTeams(['A', 'B', 'C', 'D']), 4);
      render(<EliminationBracket tournament={t} onMatchResult={onMatchResult} />);
      expect(screen.getByTestId('bracket-round-label-Semi-Final')).toBeInTheDocument();
      expect(screen.getAllByTestId('bracket-round-label-Final').length).toBeGreaterThan(0);
    });

    it('shows "4th of Final", "Semi Final", "Final" for 8 teams', () => {
      const t = EliminationTournament.create('singles').start(
        makeTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']),
        4,
      );
      render(<EliminationBracket tournament={t} onMatchResult={onMatchResult} />);
      expect(screen.getByTestId('bracket-round-label-4th-of-Final')).toBeInTheDocument();
      expect(screen.getByTestId('bracket-round-label-Semi-Final')).toBeInTheDocument();
    });
  });

  describe('match nodes', () => {
    it('renders match nodes in round 1', () => {
      const t = EliminationTournament.create('singles').start(makeTeams(['A', 'B', 'C', 'D']), 4);
      render(<EliminationBracket tournament={t} onMatchResult={onMatchResult} />);
      expect(screen.getAllByTestId(/^bracket-node-match$/).length).toBeGreaterThanOrEqual(2);
    });

    it('clicking a team opens ScoreInputModal', async () => {
      const user = userEvent.setup();
      const t = EliminationTournament.create('singles').start(makeTeams(['A', 'B', 'C', 'D']), 4);
      render(<EliminationBracket tournament={t} onMatchResult={onMatchResult} />);

      const firstR1Team = screen.getAllByTestId(/^bracket-team-1-/)[0];
      await user.click(firstR1Team);

      expect(screen.getByTestId('score-input-modal')).toBeInTheDocument();
    });

    it('confirming score modal calls onMatchResult', async () => {
      const user = userEvent.setup();
      const t = EliminationTournament.create('singles').start(makeTeams(['A', 'B', 'C', 'D']), 4);
      render(<EliminationBracket tournament={t} onMatchResult={onMatchResult} />);

      const firstR1Team = screen.getAllByTestId(/^bracket-team-1-/)[0];
      await user.click(firstR1Team);
      await user.click(screen.getByTestId('score-modal-confirm'));

      expect(onMatchResult).toHaveBeenCalledOnce();
      expect(onMatchResult.mock.calls[0][1]).toBe(1);
    });

    it('cancelling modal does not call onMatchResult', async () => {
      const user = userEvent.setup();
      const t = EliminationTournament.create('singles').start(makeTeams(['A', 'B', 'C', 'D']), 4);
      render(<EliminationBracket tournament={t} onMatchResult={onMatchResult} />);

      const firstR1Team = screen.getAllByTestId(/^bracket-team-1-/)[0];
      await user.click(firstR1Team);
      await user.click(screen.getByRole('button', { name: /close/i }));

      expect(onMatchResult).not.toHaveBeenCalled();
    });
  });

  describe('tbd nodes', () => {
    it('renders tbd nodes for undecided future rounds', () => {
      const t = EliminationTournament.create('singles').start(makeTeams(['A', 'B', 'C', 'D']), 4);
      render(<EliminationBracket tournament={t} onMatchResult={onMatchResult} />);
      expect(screen.getAllByTestId('bracket-node-tbd').length).toBeGreaterThan(0);
    });
  });

  describe('bye-advance nodes', () => {
    it('renders a bye-advance node when one team has a bye (3 teams)', () => {
      const t = EliminationTournament.create('singles').start(makeTeams(['A', 'B', 'C']), 4);
      render(<EliminationBracket tournament={t} onMatchResult={onMatchResult} />);
      expect(screen.getAllByTestId('bracket-node-bye').length).toBeGreaterThan(0);
    });

    it('bye-advance node has no buttons — winner cannot be changed or unselected via click', async () => {
      const user = userEvent.setup();
      const t = EliminationTournament.create('singles').start(makeTeams(['A', 'B', 'C']), 4);
      render(<EliminationBracket tournament={t} onMatchResult={onMatchResult} />);

      const byeNodes = screen.getAllByTestId('bracket-node-bye');
      for (const node of byeNodes) {
        expect(node.querySelector('button')).toBeNull();
      }
      await user.click(byeNodes[0]);
      expect(onMatchResult).not.toHaveBeenCalled();
    });

    it('CB bye-passer (L4) remains visible as bye-advance in CB R2 after CB R1 is complete (10-team)', () => {
      const teamNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
      let t = EliminationTournament.create('singles').start(makeTeams(teamNames), 4);
      for (const m of t.winners.matchesForRound(1)) {
        t = t.withMatchResult(m.id, 1);
      }
      render(<EliminationBracket tournament={t} onMatchResult={onMatchResult} />);
      const cbSection = screen.getByTestId('cb-section');
      expect(cbSection.querySelectorAll('[data-testid="bracket-node-bye"]').length).toBeGreaterThan(0);
    });

    it('CB R3 final is visible as a match node for 10 teams after all prior rounds complete', async () => {
      const teamNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
      let t = EliminationTournament.create('singles').start(makeTeams(teamNames), 4);

      for (const m of t.winners.matchesForRound(1)) t = t.withMatchResult(m.id, 1);
      for (const m of t.consolation.matchesForRound(1)) t = t.withMatchResult(m.id, 1);
      for (const m of t.consolation.matchesForRound(2)) t = t.withMatchResult(m.id, 1);
      for (const m of t.winners.matchesForRound(2)) t = t.withMatchResult(m.id, 1);
      for (const m of t.winners.matchesForRound(3)) t = t.withMatchResult(m.id, 1);

      render(<EliminationBracket tournament={t} onMatchResult={onMatchResult} />);
      const cbSection = screen.getByTestId('cb-section');

      const tbdNodes = cbSection.querySelectorAll('[data-testid="bracket-node-tbd"]');
      expect(tbdNodes.length).toBe(0);

      const matchNodes = cbSection.querySelectorAll('[data-testid="bracket-node-match"]');
      expect(matchNodes.length).toBe(4);
    });
  });

  describe('consolation bracket', () => {
    it('shows CB section after WB R1 is complete', async () => {
      const [A, B, C, D] = makeTeams(['A', 'B', 'C', 'D']);
      let t = EliminationTournament.create('singles').start([A, B, C, D], 4);
      const [m0, m1] = t.winners.matchesForRound(1);
      t = t.withMatchResult(m0.id, 1);
      t = t.withMatchResult(m1.id, 1);

      render(<EliminationBracket tournament={t} onMatchResult={onMatchResult} />);
      expect(screen.getByTestId('cb-section')).toBeInTheDocument();
    });
  });

  describe('3rd place section', () => {
    it('shows 3rd Place section for 8 teams (two semi-final losers)', () => {
      let t = EliminationTournament.create('singles').start(makeTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']), 4);
      for (let r = 1; r <= 2; r++) { t = playWBRound(t, r); t = playAllCBRounds(t); }

      render(<EliminationBracket tournament={t} onMatchResult={onMatchResult} />);
      expect(screen.getByTestId('tp-section')).toBeInTheDocument();
    });

    it('does not show 3rd Place section for 6 teams (single semi-final loser)', () => {
      let t = EliminationTournament.create('singles').start(makeTeams(['A', 'B', 'C', 'D', 'E', 'F']), 4);
      for (let r = 1; r <= 3; r++) { t = playWBRound(t, r); t = playAllCBRounds(t); }

      render(<EliminationBracket tournament={t} onMatchResult={onMatchResult} />);
      expect(screen.queryByTestId('tp-section')).not.toBeInTheDocument();
    });

    it('does not show 3rd Place section for 4 teams', () => {
      const t = playFullTournament(EliminationTournament.create('singles').start(makeTeams(['A', 'B', 'C', 'D']), 4));

      render(<EliminationBracket tournament={t} onMatchResult={onMatchResult} />);
      expect(screen.queryByTestId('tp-section')).not.toBeInTheDocument();
    });
  });

  describe('winners bracket section', () => {
    it('always shows WB section', () => {
      const t = EliminationTournament.create('singles').start(makeTeams(['A', 'B']), 2);
      render(<EliminationBracket tournament={t} onMatchResult={onMatchResult} />);
      expect(screen.getByTestId('wb-section')).toBeInTheDocument();
    });
  });
});
