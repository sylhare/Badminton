import React, { useMemo, useState } from 'react';

import type { Player } from '../../types';
import type { SetScore, TournamentFormat, TournamentTeam, TournamentType } from '../../tournament/types';
import { Tournament as TournamentBase } from '../../tournament/Tournament';
import { RoundRobinTournament } from '../../tournament/RoundRobinTournament';
import { EliminationTournament } from '../../tournament/EliminationTournament';
import { GroupKnockoutTournament } from '../../tournament/GroupKnockoutTournament';

import { RoundRobinMatches } from './round-robin/RoundRobinMatches';
import { TournamentSetup } from './TournamentSetup';
import { EliminationBracket } from './elimination/EliminationBracket';
import { TournamentStandings } from './TournamentStandings';

interface TournamentProps {
  tournament: RoundRobinTournament | EliminationTournament | GroupKnockoutTournament | null;
  initialPlayers: Player[];
  initialNumberOfCourts: number;
  onStart: (
    teams: TournamentTeam[],
    numberOfCourts: number,
    format: TournamentFormat,
    type: TournamentType,
    bestOf: number,
    groupSize?: number,
    qualifiersPerGroup?: number,
  ) => void;
  onMatchResult: (matchId: string, winner: 1 | 2, sets?: SetScore[]) => void;
  onReset: () => void;
  onAddPlayers: (names: string[]) => void;
  onTogglePlayer: (id: string) => void;
  showSetup?: boolean;
}

function standingsSubtitle(t: TournamentBase, isComplete: boolean): string {
  if (t instanceof EliminationTournament) {
    return isComplete ? 'Final Results' : 'In Progress';
  }
  const done = t.completedRounds();
  const total = t.totalRounds();
  return done > 0 ? `After Round ${done} / ${total}` : `Round 0 / ${total}`;
}

export const Tournament: React.FC<TournamentProps> = ({
  tournament,
  initialPlayers,
  initialNumberOfCourts,
  onStart,
  onMatchResult,
  onReset,
  onAddPlayers,
  onTogglePlayer,
  showSetup,
}) => {
  const [selectedType, setSelectedType] = useState<TournamentType>('round-robin');
  const isSetupPhase = !tournament || tournament.phase() === 'setup';
  const standings = useMemo(
    () => (isSetupPhase || showSetup) ? [] : (tournament?.calculateStandings() ?? []),
    [tournament, isSetupPhase, showSetup],
  );

  if (isSetupPhase || showSetup) {
    return (
      <div className="tournament-setup-wrapper">
        <div className="tournament-type-selector setup-section" data-testid="tournament-type-selector">
          <h3>Mode</h3>
          <div className="format-pills">
            <button
              className={`format-pill${selectedType === 'round-robin' ? ' format-pill-active' : ''}`}
              onClick={() => setSelectedType('round-robin')}
              data-testid="type-pill-round-robin"
            >
              Round Robin
            </button>
            <button
              className={`format-pill${selectedType === 'elimination' ? ' format-pill-active' : ''}`}
              onClick={() => setSelectedType('elimination')}
              data-testid="type-pill-elimination"
            >
              Elimination
            </button>
          </div>
        </div>
        <TournamentSetup
          initialPlayers={initialPlayers}
          initialNumberOfCourts={initialNumberOfCourts}
          onStart={(teams, courts, format, bestOf) => onStart(teams, courts, format, selectedType, bestOf)}
          onAddPlayers={onAddPlayers}
          onTogglePlayer={onTogglePlayer}
        />
      </div>
    );
  }

  const isComplete = tournament.isComplete();
  const isElimination = tournament instanceof EliminationTournament;

  let matchesView: React.ReactNode = null; // group-knockout view added in a later step
  if (tournament instanceof EliminationTournament) {
    matchesView = <EliminationBracket tournament={tournament} onMatchResult={onMatchResult} />;
  } else if (tournament instanceof RoundRobinTournament) {
    matchesView = <RoundRobinMatches tournament={tournament} onMatchResult={onMatchResult} />;
  }

  return (
    <div className="tournament-active-layout">
      {matchesView}
      <TournamentStandings
        standings={standings}
        isComplete={isComplete}
        subtitle={standingsSubtitle(tournament, isComplete)}
        showPoints={!isElimination}
      />
      <button
        className="button button-primary"
        onClick={onReset}
        data-testid="new-tournament-button"
      >
        Start a New Tournament
      </button>
    </div>
  );
};

