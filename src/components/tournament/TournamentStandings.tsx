import React from 'react';

import type { TournamentStandingRow } from '../../tournament/types';

import { StandingsTable } from './common/StandingsTable';

interface TournamentStandingsProps {
  standings: TournamentStandingRow[];
  isComplete: boolean;
  subtitle: string;
  showPoints?: boolean;
}

const RANK_EMOJI = ['🥇', '🥈', '🥉'];

export const TournamentStandings: React.FC<TournamentStandingsProps> = ({
  standings,
  isComplete,
  subtitle,
  showPoints,
}) => {
  return (
    <div className="tournament-standings" data-testid="tournament-standings">
      <h2>Standings</h2>
      <p className="standings-subtitle" data-testid="standings-subtitle">{subtitle}</p>

      <StandingsTable
        rows={standings}
        rankHeader="Rank"
        rankCell={rank => (isComplete && rank < 3 ? RANK_EMOJI[rank] : rank + 1)}
        rowClass={rank => (rank === 0 && standings.length > 1 ? 'top' : '')}
        testIdFor={rank => `standing-row-${rank}`}
        showPoints={!!showPoints}
        showScoreDiff={!!showPoints}
      />
    </div>
  );
};

