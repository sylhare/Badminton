import React, { useState } from 'react';

import type { OnMatchResult, TournamentTeam } from '../../tournament/types';
import { GroupKnockoutTournament } from '../../tournament/GroupKnockoutTournament';
import ManualOrderModal from '../modals/ManualOrderModal';

import { RoundRobinMatches } from './round-robin/RoundRobinMatches';
import { EliminationBracket } from './elimination/EliminationBracket';
import { StandingsTable } from './common/StandingsTable';
import { TournamentStandings } from './TournamentStandings';

interface GroupKnockoutProps {
  tournament: GroupKnockoutTournament;
  onMatchResult: OnMatchResult;
  onUpdateTournament: (next: GroupKnockoutTournament) => void;
}

const groupLabel = (index: number): string => `Group ${String.fromCharCode(65 + index)}`;

export const GroupKnockout: React.FC<GroupKnockoutProps> = ({ tournament, onMatchResult, onUpdateTournament }) => {
  const groups = tournament.groups();
  const qualifiersPerGroup = tournament.qualifiersPerGroup();
  const knockoutStarted = tournament.knockoutStarted();
  const isComplete = tournament.isComplete();
  const canBreakTies = tournament.groupPhaseComplete();
  const [tiedTeams, setTiedTeams] = useState<TournamentTeam[] | null>(null);

  const saveOrder = (orderedTeamIds: string[]) => {
    onUpdateTournament(tournament.withManualOrder(orderedTeamIds));
    setTiedTeams(null);
  };

  return (
    <div className="group-knockout" data-testid="group-knockout">
      <div className="group-stage" data-testid="group-stage">
        {groups.map((_, groupIndex) => {
          const groupTournament = tournament.groupTournament(groupIndex);
          const standings = tournament.groupStandings(groupIndex);
          const tieByRank = new Map<number, TournamentTeam[]>();
          if (canBreakTies) {
            for (const tie of tournament.tieGroups(standings)) {
              const teams = tie.map(rank => standings[rank].team);
              for (const rank of tie) tieByRank.set(rank, teams);
            }
          }
          return (
            <section key={groupIndex} className="group-section" data-testid={`group-section-${groupIndex}`}>
              <h3>{groupLabel(groupIndex)}</h3>
              <StandingsTable
                rows={standings}
                rankHeader="#"
                rankCell={rank => {
                  const tied = tieByRank.get(rank);
                  if (!tied) return rank + 1;
                  return (
                    <button
                      type="button"
                      className="tie-break-button"
                      onClick={() => setTiedTeams(tied)}
                      aria-label="Set tie-break order"
                      data-testid={`tie-break-${groupIndex}-${rank}`}
                    >
                      <span aria-hidden>⇅</span>
                      <span className="tie-break-flag" aria-hidden>⚑</span>
                    </button>
                  );
                }}
                rowClass={rank => [
                  rank < qualifiersPerGroup ? 'qualified' : '',
                  tieByRank.has(rank) ? 'tied' : '',
                ].filter(Boolean).join(' ')}
                testIdFor={rank => `group-${groupIndex}-standing-${rank}`}
                showMetrics
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

      {isComplete && (
        <div className="group-knockout-final" data-testid="group-knockout-final">
          <TournamentStandings
            standings={tournament.overallStandings()}
            isComplete
            subtitle="Final Results"
            showPoints
          />
        </div>
      )}

      <ManualOrderModal
        isOpen={tiedTeams !== null}
        teams={tiedTeams ?? []}
        onConfirm={saveOrder}
        onCancel={() => setTiedTeams(null)}
      />
    </div>
  );
};
