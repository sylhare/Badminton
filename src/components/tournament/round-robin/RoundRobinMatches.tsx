import React from 'react';

import type { SetScore, TournamentMatch } from '../../../tournament/types';
import { formatSets } from '../../../tournament/types';
import { RoundRobinTournament } from '../../../tournament/RoundRobinTournament';
import { DoublesMatch, SinglesMatch } from '../../court/display';
import { useMatchModal } from '../useMatchModal';

import { useExpandedRounds } from './useExpandedRounds';

interface RoundRobinMatchesProps {
  tournament: RoundRobinTournament;
  onMatchResult: (matchId: string, winner: 1 | 2, sets?: SetScore[]) => void;
}

export const RoundRobinMatches: React.FC<RoundRobinMatchesProps> = ({
  tournament,
  onMatchResult,
}) => {
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
            className={`round-section${roundDone ? ' round-complete' : ''}`}
            data-testid={`round-${round}`}
          >
            <div
              className="round-header"
              onClick={() => toggle(round)}
              data-testid={`round-header-${round}`}
            >
              <h3>Round {round}</h3>
              <span className="round-status">
                {roundDone ? '✓ Complete' : `${roundMatches.filter(m => m.winner).length}/${roundMatches.length} done`}
              </span>
              <span className="collapse-indicator">{expanded ? '▼' : '▶'}</span>
            </div>

            {expanded && (
              <div className="round-matches" data-testid="round-matches">
                {roundMatches.map(match => {
                  const score = formatSets(match.sets);
                  return (
                    <div
                      key={match.id}
                      className={`match-row${match.winner ? ' match-complete' : ''}`}
                      data-testid={`match-${match.id}`}
                    >
                      <div className="match-court">Court {match.courtNumber}</div>
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

      {scoreModal(tournament.state().bestOf)}
    </div>
  );
};

