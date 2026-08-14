import React, { useState } from 'react';

import type { TournamentStandingRow } from '../../tournament/types';
import ManualOrderModal from '../modals/ManualOrderModal';
import { cx } from '../common/cx';

import { StandingsTable } from './common/StandingsTable';

interface TournamentStandingsProps {
  standings: TournamentStandingRow[];
  isComplete: boolean;
  subtitle: string;
  showPoints?: boolean;
  /** Runs of tied row indices the metrics can't separate; enables the tie-break control when non-empty. */
  tieGroups?: number[][];
  /** Persist a hand-chosen order for the tied teams (best first). */
  onResolveTies?: (orderedTeamIds: string[]) => void;
}

const RANK_EMOJI = ['🥇', '🥈', '🥉'];

export const TournamentStandings: React.FC<TournamentStandingsProps> = ({
  standings,
  isComplete,
  subtitle,
  showPoints,
  tieGroups,
  onResolveTies,
}) => {
  const [ordering, setOrdering] = useState(false);
  const tiedRanks = new Set((tieGroups ?? []).flat());
  const canResolve = tiedRanks.size > 0 && !!onResolveTies;

  return (
    <div className="tournament-standings" data-testid="tournament-standings">
      <h2>Standings</h2>
      <p className="standings-subtitle" data-testid="standings-subtitle">{subtitle}</p>

      <StandingsTable
        rows={standings}
        rankHeader="Rank"
        rankCell={rank => {
          const base = isComplete && rank < 3 ? RANK_EMOJI[rank] : rank + 1;
          if (!tiedRanks.has(rank)) return base;
          return (
            <span className="standing-rank-tied">
              {base}
              <span
                className="tie-warning"
                title="Tied on every metric — set the finishing order by hand"
                aria-label="Tied — needs manual ordering"
                data-testid={`standing-tie-flag-${rank}`}
              >
                ⚠
              </span>
            </span>
          );
        }}
        rowClass={rank => cx(rank === 0 && standings.length > 1 && 'top', tiedRanks.has(rank) && 'tied')}
        testIdFor={rank => `standing-row-${rank}`}
        showMetrics={!!showPoints}
      />

      {canResolve && (
        <button
          type="button"
          className="tie-break-button standings-tie-break"
          onClick={() => setOrdering(true)}
          data-testid="standings-tie-break"
        >
          <span aria-hidden>⇅</span> Set tie-break order
        </button>
      )}

      <ManualOrderModal
        isOpen={ordering}
        teams={(tieGroups ?? []).flat().map(rank => standings[rank].team)}
        onConfirm={orderedTeamIds => { onResolveTies?.(orderedTeamIds); setOrdering(false); }}
        onCancel={() => setOrdering(false)}
      />
    </div>
  );
};
