import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { LocalizedDescriptor, TournamentStandingRow } from '../../tournament/types';
import ManualOrderModal from '../modals/ManualOrderModal';
import { cx } from '../common/cx';

import { StandingsTable } from './common/StandingsTable';

interface TournamentStandingsProps {
  standings: TournamentStandingRow[];
  isComplete: boolean;
  subtitle: LocalizedDescriptor | string;
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
  const { t } = useTranslation();
  const [ordering, setOrdering] = useState(false);
  const tiedRanks = new Set((tieGroups ?? []).flat());
  const canResolve = tiedRanks.size > 0 && !!onResolveTies;
  const subtitleText = typeof subtitle === 'string' ? subtitle : t(subtitle.key, subtitle.params);

  return (
    <div className="tournament-standings" data-testid="tournament-standings">
      <h2>{t('tournament.standings.title')}</h2>
      <p className="standings-subtitle" data-testid="standings-subtitle">{subtitleText}</p>

      <StandingsTable
        rows={standings}
        rankHeader={t('tournament.standings.table.rank')}
        rankCell={rank => {
          const base = isComplete && rank < 3 ? RANK_EMOJI[rank] : rank + 1;
          if (!tiedRanks.has(rank)) return base;
          return (
            <span className="standing-rank-tied">
              {base}
              <span
                className="tie-warning"
                title={t('tournament.standings.tieBreakTitle')}
                aria-label={t('tournament.standings.tieBreakAria')}
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
          <span aria-hidden>⇅</span> {t('tournament.standings.setTieBreakOrder')}
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
