import React, { useMemo, useState } from 'react';

import type { Player } from '../../types';
import type { SetScore, TournamentFormat, TournamentTeam, TournamentType } from '../../tournament/types';
import type { Tournament as TournamentBase } from '../../tournament/Tournament';

import { TournamentSetup } from './TournamentSetup';
import { TournamentStandings } from './TournamentStandings';
import { TOURNAMENT_KINDS, TOURNAMENT_TYPES } from './tournamentKinds';
import { PillGroup } from './PillGroup';

interface TournamentProps {
  tournament: TournamentBase | null;
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
    () => (isSetupPhase || showSetup || !(tournament?.showsCombinedStandings() ?? true))
      ? []
      : (tournament?.calculateStandings() ?? []),
    [tournament, isSetupPhase, showSetup],
  );

  if (isSetupPhase || showSetup) {
    return (
      <div className="tournament-setup-wrapper">
        <div className="tournament-type-selector setup-section" data-testid="tournament-type-selector">
          <h3>Mode</h3>
          <PillGroup
            options={TOURNAMENT_TYPES}
            selected={selectedType}
            onSelect={setSelectedType}
            label={type => TOURNAMENT_KINDS[type].label}
            testIdFor={type => `type-pill-${type}`}
          />
        </div>
        <TournamentSetup
          initialPlayers={initialPlayers}
          initialNumberOfCourts={initialNumberOfCourts}
          type={selectedType}
          onStart={(teams, courts, format, bestOf, groupSize, qualifiersPerGroup) =>
            onStart(teams, courts, format, selectedType, bestOf, groupSize, qualifiersPerGroup)}
          onAddPlayers={onAddPlayers}
          onTogglePlayer={onTogglePlayer}
        />
      </div>
    );
  }

  const isComplete = tournament.isComplete();
  const kind = TOURNAMENT_KINDS[tournament.state().type];

  return (
    <div className="tournament-active-layout">
      {kind.renderMatches(tournament, onMatchResult)}
      {tournament.showsCombinedStandings() && (
        <TournamentStandings
          standings={standings}
          isComplete={isComplete}
          subtitle={tournament.standingsSubtitle()}
          showPoints={tournament.showsPoints()}
        />
      )}
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

