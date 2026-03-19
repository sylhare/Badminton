import React, { useEffect, useRef, useState } from 'react';

import { useMatchScoring } from '../../hooks/useMatchScoring';
import { usePlayers } from '../../hooks/usePlayers';
import type { TournamentMatch } from '../../types/tournament';
import Tournament from '../../utils/Tournament';
import { DoublesMatch, SinglesMatch } from '../court/display';
import ScoreInputModal from '../modals/ScoreInputModal';

interface TournamentMatchesProps {
  matches: TournamentMatch[];
  onMatchResult: (matchId: string, winner: 1 | 2, score?: { team1: number; team2: number }) => void;
}

function getCurrentRoundInfo(matches: TournamentMatch[]): { currentRound: number; roundNums: number[] } {
  const roundNums = Tournament.getSortedRoundNums(matches);
  for (const r of roundNums) {
    if (matches.filter(m => m.round === r).some(m => m.winner === undefined)) {
      return { currentRound: r, roundNums };
    }
  }
  return { currentRound: roundNums[roundNums.length - 1] ?? 1, roundNums };
}

function getRoundLabel(round: number): string {
  return `Round ${round}`;
}

const TournamentMatches: React.FC<TournamentMatchesProps> = ({
  matches,
  onMatchResult,
}) => {
  const { playersFrom } = usePlayers();
  const { modalMatch, pendingWinner, handleTeamClick, handleModalConfirm, handleModalCancel } =
    useMatchScoring(onMatchResult);
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(() => {
    const { currentRound: cur } = getCurrentRoundInfo(matches);
    return new Set([cur]);
  });

  const { currentRound, roundNums } = getCurrentRoundInfo(matches);

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

  const isSingles = (match: TournamentMatch) => match.team1.playerIds.length === 1;

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
              <h3>{getRoundLabel(round)}</h3>
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
                            team1Player={playersFrom(match.team1.playerIds)[0]}
                            team2Player={playersFrom(match.team2.playerIds)[0]}
                            winner={match.winner}
                            isClickable={true}
                            onPlayerClick={(_e, teamNum) => handleTeamClick(match, teamNum as 1 | 2)}
                          />
                        ) : (
                          <DoublesMatch
                            team1Players={playersFrom(match.team1.playerIds)}
                            team2Players={playersFrom(match.team2.playerIds)}
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
        team1Players={playersFrom(modalMatch?.team1.playerIds)}
        team2Players={playersFrom(modalMatch?.team2.playerIds)}
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
      />
    </div>
  );
};

export default TournamentMatches;
