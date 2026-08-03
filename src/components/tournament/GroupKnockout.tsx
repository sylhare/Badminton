import React from 'react';

import type { SetScore } from '../../tournament/types';
import { formatTeamName } from '../../tournament/types';
import { GroupKnockoutTournament } from '../../tournament/GroupKnockoutTournament';

import { RoundRobinMatches } from './round-robin/RoundRobinMatches';
import { EliminationBracket } from './elimination/EliminationBracket';

interface GroupKnockoutProps {
  tournament: GroupKnockoutTournament;
  onMatchResult: (matchId: string, winner: 1 | 2, sets?: SetScore[]) => void;
}

const groupLabel = (index: number): string => `Group ${String.fromCharCode(65 + index)}`;

export const GroupKnockout: React.FC<GroupKnockoutProps> = ({ tournament, onMatchResult }) => {
  const groups = tournament.groups();
  const qualifiersPerGroup = tournament.qualifiersPerGroup();
  const knockoutStarted = tournament.knockoutStarted();

  return (
    <div className="group-knockout" data-testid="group-knockout">
      <div className="group-stage" data-testid="group-stage">
        {groups.map((_, groupIndex) => {
          const standings = tournament.groupStandings(groupIndex);
          return (
            <section key={groupIndex} className="group-section" data-testid={`group-section-${groupIndex}`}>
              <h3>{groupLabel(groupIndex)}</h3>
              <div className="standings-table-wrapper">
                <table className="leaderboard-table standings-table group-standings">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Team</th>
                      <th>W</th>
                      <th>L</th>
                      <th>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((row, rank) => (
                      <tr
                        key={row.team.id}
                        className={rank < qualifiersPerGroup ? 'qualified' : ''}
                        data-testid={`group-${groupIndex}-standing-${rank}`}
                      >
                        <td>{rank + 1}</td>
                        <td>{formatTeamName(row.team)}</td>
                        <td>{row.won}</td>
                        <td>{row.lost}</td>
                        <td>{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <RoundRobinMatches tournament={tournament.groupTournament(groupIndex)} onMatchResult={onMatchResult} />
            </section>
          );
        })}
      </div>

      {knockoutStarted && (
        <div className="knockout-stage" data-testid="knockout-stage">
          <h2>Knockout Stage</h2>
          <EliminationBracket tournament={tournament.knockout()} onMatchResult={onMatchResult} />
        </div>
      )}
    </div>
  );
};
