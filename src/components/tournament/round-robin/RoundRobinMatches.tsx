import React, { useEffect, useRef, useState } from 'react';

import type { TournamentMatch } from '../../../tournament/types';
import { RoundRobinTournament } from '../../../tournament/RoundRobinTournament';
import { DoublesMatch, SinglesMatch } from '../../court/display';
import ScoreInputModal from '../../modals/ScoreInputModal';

interface RoundRobinMatchesProps {
  tournament: RoundRobinTournament;
  onMatchResult: (matchId: string, winner: 1 | 2, score?: { team1: number; team2: number }) => void;
}

const RoundRobinMatches: React.FC<RoundRobinMatchesProps> = ({
  tournament,
  onMatchResult,
}) => {
  const [modalMatch, setModalMatch] = useState<TournamentMatch | null>(null);
  const [pendingWinner, setPendingWinner] = useState<1 | 2 | null>(null);
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(() =>
    new Set([tournament.currentRound()]),
  );

  const currentRound = tournament.currentRound();
  const roundNums = tournament.roundNumbers();
  const allComplete = tournament.isComplete();

  const prevCurrentRoundRef = useRef(currentRound);
  useEffect(() => {
    const prev = prevCurrentRoundRef.current;
    if (prev !== currentRound) {
      setExpandedRounds(existing => {
        const next = new Set(existing);
        next.delete(prev);
        next.add(currentRound);
        return next;
      });
      prevCurrentRoundRef.current = currentRound;
    }
  }, [currentRound]);

  const prevAllCompleteRef = useRef(allComplete);
  useEffect(() => {
    if (allComplete && !prevAllCompleteRef.current) {
      setExpandedRounds(new Set());
    }
    prevAllCompleteRef.current = allComplete;
  }, [allComplete]);

  const toggleRound = (round: number) => {
    setExpandedRounds(prev => {
      const next = new Set(prev);
      if (next.has(round)) {
        next.delete(round);
      } else {
        next.add(round);
      }
      return next;
    });
  };

  const handleTeamClick = (match: TournamentMatch, teamNumber: 1 | 2) => {
    if (match.winner === teamNumber) {
      onMatchResult(match.id, teamNumber);
      return;
    }
    setModalMatch(match);
    setPendingWinner(teamNumber);
  };

  const handleModalConfirm = (score: { team1: number; team2: number }) => {
    if (!modalMatch || pendingWinner === null) return;
    onMatchResult(modalMatch.id, pendingWinner, score);
    setModalMatch(null);
    setPendingWinner(null);
  };

  const handleModalCancel = () => {
    setModalMatch(null);
    setPendingWinner(null);
  };

  const isSingles = (match: TournamentMatch) => match.team1.players.length === 1;

  const formatScore = (match: TournamentMatch) => {
    if (!match.score) return null;
    return `${match.score.team1} – ${match.score.team2}`;
  };

  return (
    <div className="tournament-matches" data-testid="tournament-matches">
      {roundNums.map(round => {
        const roundMatches = tournament.matchesForRound(round);
        const isExpanded = expandedRounds.has(round) || (!allComplete && round === currentRound);
        const roundDone = tournament.isRoundComplete(round);

        return (
          <div
            key={round}
            className={`round-section${roundDone ? ' round-complete' : ''}`}
            data-testid={`round-${round}`}
          >
            <div
              className="round-header"
              onClick={() => toggleRound(round)}
              data-testid={`round-header-${round}`}
            >
              <h3>Round {round}</h3>
              <span className="round-status">
                {roundDone ? '✓ Complete' : `${roundMatches.filter(m => m.winner).length}/${roundMatches.length} done`}
              </span>
              <span className="collapse-indicator">{isExpanded ? '▼' : '▶'}</span>
            </div>

            {isExpanded && (
              <div className="round-matches">
                {roundMatches.map(match => (
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
                        {formatScore(match) && (
                          <span className="match-score">{formatScore(match)}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <ScoreInputModal
        isOpen={modalMatch !== null && pendingWinner !== null}
        winnerTeam={pendingWinner ?? 1}
        team1Players={modalMatch?.team1.players ?? []}
        team2Players={modalMatch?.team2.players ?? []}
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
      />
    </div>
  );
};

export default RoundRobinMatches;
