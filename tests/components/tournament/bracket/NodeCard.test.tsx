import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { NodeCard } from '../../../../src/components/tournament/bracket/NodeCard';
import type { BracketNode } from '../../../../src/components/tournament/bracket/types';
import type { TournamentMatch, TournamentTeam } from '../../../../src/types/tournament';
import { createMockPlayer } from '../../../data/testFactories';

function makeTeam(id: string, name: string): TournamentTeam {
  return { id, players: [createMockPlayer({ id: `${id}-p0`, name })] };
}

function makeMatch(
  id: string,
  team1: TournamentTeam,
  team2: TournamentTeam,
  winner?: 1 | 2,
  score?: { team1: number; team2: number },
): TournamentMatch {
  return { id, round: 1, courtNumber: 1, team1, team2, winner, score };
}

const tA = makeTeam('a', 'Alice');
const tB = makeTeam('b', 'Bob');

function renderNode(node: BracketNode, onTeamClick = vi.fn()) {
  return render(
    <div style={{ position: 'relative' }}>
      <NodeCard node={node} top={0} left={0} onTeamClick={onTeamClick} />
    </div>,
  );
}

describe('NodeCard', () => {
  describe('type=\'tbd\'', () => {
    it('renders two TBD texts', () => {
      renderNode({ type: 'tbd', team1: null, team2: null });
      expect(screen.getAllByText('TBD')).toHaveLength(2);
    });
  });

  describe('type=\'bye-advance\'', () => {
    it('renders team name + BYE', () => {
      renderNode({ type: 'bye-advance', team1: tA, team2: null });
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('BYE')).toBeInTheDocument();
    });

    it('renders TBD when team1 is null', () => {
      renderNode({ type: 'bye-advance', team1: null, team2: null });
      expect(screen.getByText('TBD')).toBeInTheDocument();
      expect(screen.getByText('BYE')).toBeInTheDocument();
    });
  });

  describe('type=\'match\'', () => {
    it('renders both team names', () => {
      const match = makeMatch('m1', tA, tB);
      renderNode({ type: 'match', match, team1: tA, team2: tB });
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('clicking team1 calls onTeamClick(match, 1)', async () => {
      const user = userEvent.setup();
      const onTeamClick = vi.fn();
      const match = makeMatch('m1', tA, tB);
      renderNode({ type: 'match', match, team1: tA, team2: tB }, onTeamClick);

      await user.click(screen.getByTestId('bracket-team-1-m1'));
      expect(onTeamClick).toHaveBeenCalledWith(match, 1);
    });

    it('clicking team2 calls onTeamClick(match, 2)', async () => {
      const user = userEvent.setup();
      const onTeamClick = vi.fn();
      const match = makeMatch('m1', tA, tB);
      renderNode({ type: 'match', match, team1: tA, team2: tB }, onTeamClick);

      await user.click(screen.getByTestId('bracket-team-2-m1'));
      expect(onTeamClick).toHaveBeenCalledWith(match, 2);
    });

    it('winner=1: team1 has bracket-team-winner class, team2 has bracket-team-loser class', () => {
      const match = makeMatch('m1', tA, tB, 1);
      renderNode({ type: 'match', match, team1: tA, team2: tB });

      expect(screen.getByTestId('bracket-team-1-m1')).toHaveClass('bracket-team-winner');
      expect(screen.getByTestId('bracket-team-2-m1')).toHaveClass('bracket-team-loser');
    });

    it('winner=1: clicking team2 (loser) does not call onTeamClick', async () => {
      const user = userEvent.setup();
      const onTeamClick = vi.fn();
      const match = makeMatch('m1', tA, tB, 1);
      renderNode({ type: 'match', match, team1: tA, team2: tB }, onTeamClick);

      await user.click(screen.getByTestId('bracket-team-2-m1'));
      expect(onTeamClick).not.toHaveBeenCalled();
    });

    it('shows score next to winner name', () => {
      const match = makeMatch('m1', tA, tB, 1, { team1: 21, team2: 15 });
      renderNode({ type: 'match', match, team1: tA, team2: tB });

      expect(screen.getByText('21–15')).toBeInTheDocument();
    });

    it('data-testid attributes are present', () => {
      const match = makeMatch('m1', tA, tB);
      renderNode({ type: 'match', match, team1: tA, team2: tB });

      expect(screen.getByTestId('bracket-match-m1')).toBeInTheDocument();
      expect(screen.getByTestId('bracket-team-1-m1')).toBeInTheDocument();
      expect(screen.getByTestId('bracket-team-2-m1')).toBeInTheDocument();
    });
  });
});
