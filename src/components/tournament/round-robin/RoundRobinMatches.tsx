import React from 'react';

import type { OnMatchResult, TournamentMatch } from '../../../tournament/types';
import { MatchScore } from '../../../scoring/MatchScore';
import { RoundRobinTournament } from '../../../tournament/RoundRobinTournament';
import { DoublesMatch, SinglesMatch } from '../../court/display';
import { cx } from '../../common/cx';
import { useMatchModal } from '../useMatchModal';
import { useTranslation } from '../../../i18n';

import { useExpandedRounds } from './useExpandedRounds';

interface RoundRobinMatchesProps {
  tournament: RoundRobinTournament;
  onMatchResult: OnMatchResult;
}

export const RoundRobinMatches: React.FC<RoundRobinMatchesProps> = ({
  tournament,
  onMatchResult,
}) => {
  const { t } = useTranslation();
  const { handleTeamClick, scoreModal } = useMatchModal(onMatchResult);

  const currentRound = tournament.currentRound();
  const roundNums = tournament.roundNumbers();
  const { isExpanded, toggle } = useExpandedRounds(currentRound, tournament.isComplete());

  const isSingles = (match: TournamentMatch) => match.team1.players.length === 1;

  return (
    <div className="tournament-matches" data-testid="tournament-matches">
      {roundNums.map(round => {
        const roundMatches = tournament.matchesForRound(round);
        const expanded = isExpanded(round);
        const roundDone = tournament.isRoundComplete(round);

        return (
          <div
            key={round}
            className={cx('round-section', roundDone && 'round-complete')}
            data-testid={`round-${round}`}
          >
            <div
              className="round-header"
              onClick={() => toggle(round)}
              data-testid={`round-header-${round}`}
            >
              <h3>{t('tournament.round', { number: round })}</h3>
              <span className="round-status">
                {roundDone
                  ? t('tournament.roundComplete')
                  : t('tournament.roundProgress', {
                    done: roundMatches.filter(m => m.winner).length,
                    total: roundMatches.length,
                  })}
              </span>
              <span className="collapse-indicator">{expanded ? '▼' : '▶'}</span>
            </div>

            {expanded && (
              <div className="round-matches" data-testid="round-matches">
                {roundMatches.map(match => {
                  const score = MatchScore.of(match.sets, match.winner).formatted();
                  return (
                    <div
                      key={match.id}
                      className={cx('match-row', match.winner && 'match-complete')}
                      data-testid={`match-${match.id}`}
                    >
                      <div className="match-court">{t('tournament.court', { number: match.courtNumber })}</div>
                      <div className="match-display">
                        {isSingles(match) ? (
                          <SinglesMatch
                            team1Player={match.team1.players[0]}
                            team2Player={match.team2.players[0]}
                            winner={match.winner}
                            isClickable={true}
                            onPlayerClick={(_e, teamNum) => handleTeamClick(match, teamNum as 1 | 2)}
                          />
                        ) : (
                          <DoublesMatch
                            team1Players={match.team1.players}
                            team2Players={match.team2.players}
                            winner={match.winner}
                            isClickable={true}
                            onTeamClick={(_e, teamNum) => handleTeamClick(match, teamNum as 1 | 2)}
                          />
                        )}
                      </div>
                      {match.winner && (
                        <div className="match-result" data-testid={`match-result-${match.id}`}>
                          {score && <span className="match-score">{score}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {scoreModal(tournament.state().bestOf, tournament.state().setSize)}
    </div>
  );
};

