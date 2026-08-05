import React from 'react';

import type { SetScore } from '../../tournament/types';
import { GroupKnockoutTournament } from '../../tournament/GroupKnockoutTournament';

import { RoundRobinMatches } from './round-robin/RoundRobinMatches';
import { EliminationBracket } from './elimination/EliminationBracket';
import { StandingsTable } from './StandingsTable';

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
          const groupTournament = tournament.groupTournament(groupIndex);
          const standings = groupTournament.calculateStandings();
          return (
            <section key={groupIndex} className="group-section" data-testid={`group-section-${groupIndex}`}>
              <h3>{groupLabel(groupIndex)}</h3>
              <StandingsTable
                rows={standings}
                rankHeader="#"
                rankCell={rank => rank + 1}
                rowClass={rank => (rank < qualifiersPerGroup ? 'qualified' : '')}
                testIdFor={rank => `group-${groupIndex}-standing-${rank}`}
                showPoints
                showScoreDiff={false}
                extraClassName="group-standings"
              />
              <RoundRobinMatches tournament={groupTournament} onMatchResult={onMatchResult} />
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
