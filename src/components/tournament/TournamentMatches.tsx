import React, { useEffect, useRef, useState } from 'react';

import type { TournamentMatch } from '../../types/tournament';
import Tournament from '../../utils/Tournament';
import { DoublesMatch, SinglesMatch } from '../court/display';
import ScoreInputModal from '../modals/ScoreInputModal';

interface TournamentMatchesProps {
  matches: TournamentMatch[];
  onMatchResult: (matchId: string, winner: 1 | 2, score?: { team1: number; team2: number }) => void;
}

function getCurrentRound(matches: TournamentMatch[]): number {
  const roundNums = Tournament.getSortedRoundNums(matches);
  for (const r of roundNums) {
    if (matches.filter(m => m.round === r).some(m => m.winner === undefined)) {
      return r;
    }
  }
  return roundNums[roundNums.length - 1] ?? 1;
}

function getRoundLabel(_allMatches: TournamentMatch[], round: number): string {
  return `Round ${round}`;
}

const TournamentMatches: React.FC<TournamentMatchesProps> = ({
  matches,
  onMatchResult,
}) => {
  const [modalMatch, setModalMatch] = useState<TournamentMatch | null>(null);
  const [pendingWinner, setPendingWinner] = useState<1 | 2 | null>(null);
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(() => {
    const cur = getCurrentRound(matches);
    return new Set([cur]);
  });

  const currentRound = getCurrentRound(matches);
  const roundNums = Tournament.getSortedRoundNums(matches);

  const allComplete = matches.every(m => m.winner !== undefined);

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
        const roundMatches = matches.filter(m => m.round === round);
        const isExpanded = expandedRounds.has(round) || (!allComplete && round === currentRound);
        const roundDone = roundMatches.every(m => m.winner !== undefined);

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
              <h3>{getRoundLabel(matches, round)}</h3>
              <span className="round-status">
                {roundDone ? '✓ Complete' : `${roundMatches.filter(m => m.winner).length}/${roundMatches.length} done`}
              </span>
              <span className="collapse-indicator">{isExpanded ? '▼' : '▶'}</span>
            </div>

            {isExpanded && (
              <div className="round-matches">
                {roundMatches.map(match => {
                  const score = formatScore(match);
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

export default TournamentMatches;
