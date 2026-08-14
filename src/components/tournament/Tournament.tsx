import React, { useMemo, useState } from 'react';

import type { Player } from '../../types';
import type { OnMatchResult, TournamentTeam, TournamentType } from '../../tournament/types';
import type { Tournament as TournamentBase } from '../../tournament/Tournament';
import type { CreateTournamentOptions } from '../../tournament/tournamentFactory';
import { SegmentedControl } from '../common/SegmentedControl';
import ConfirmModal from '../modals/ConfirmModal';

import { TournamentSetup } from './TournamentSetup';
import { TournamentStandings } from './TournamentStandings';
import { TOURNAMENT_KINDS, TOURNAMENT_TYPES } from './tournamentKinds';

interface TournamentProps {
  tournament: TournamentBase | null;
  initialPlayers: Player[];
  initialNumberOfCourts: number;
  onStart: (teams: TournamentTeam[], options: CreateTournamentOptions) => void;
  onMatchResult: OnMatchResult;
  onUpdateTournament: (next: TournamentBase) => void;
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
  onUpdateTournament,
  onReset,
  onAddPlayers,
  onTogglePlayer,
  showSetup,
}) => {
  const [selectedType, setSelectedType] = useState<TournamentType>('round-robin');
  const [confirmingReset, setConfirmingReset] = useState(false);
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
          <SegmentedControl
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
          onStart={onStart}
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
      {kind.renderMatches(tournament, onMatchResult, onUpdateTournament)}
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
        onClick={() => setConfirmingReset(true)}
        data-testid="new-tournament-button"
      >
        Start a New Tournament
      </button>
      <ConfirmModal
        isOpen={confirmingReset}
        title="Start a new tournament?"
        message="This discards the current tournament and its results. Are you sure you want to start a new one?"
        confirmText="Start new"
        isDestructive
        onConfirm={() => { setConfirmingReset(false); onReset(); }}
        onCancel={() => setConfirmingReset(false)}
      />
    </div>
  );
};

