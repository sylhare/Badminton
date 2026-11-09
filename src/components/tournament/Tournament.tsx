import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const [typeOverride, setTypeOverride] = useState<TournamentType | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const selectedType = typeOverride ?? tournament?.state().type ?? 'round-robin';
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
          <h2>{t('tournament.mode')}</h2>
          <SegmentedControl
            options={TOURNAMENT_TYPES}
            selected={selectedType}
            onSelect={setTypeOverride}
            label={type => t(TOURNAMENT_KINDS[type].labelKey)}
            testIdFor={type => `type-pill-${type}`}
          />
        </div>
        <TournamentSetup
          initialPlayers={initialPlayers}
          initialNumberOfCourts={initialNumberOfCourts}
          type={selectedType}
          initialConfig={tournament?.state()}
          onStart={onStart}
          onAddPlayers={onAddPlayers}
          onTogglePlayer={onTogglePlayer}
        />
      </div>
    );
  }

  const isComplete = tournament.isComplete();
  const kind = TOURNAMENT_KINDS[tournament.state().type];
  const tieGroups = isComplete && tournament.state().type === 'round-robin'
    ? tournament.tieGroups(standings)
    : [];

  return (
    <div className="tournament-active-layout">
      {kind.renderMatches(tournament, onMatchResult, onUpdateTournament)}
      {tournament.showsCombinedStandings() && (
        <TournamentStandings
          standings={standings}
          isComplete={isComplete}
          subtitle={tournament.standingsSubtitle()}
          showPoints={tournament.showsPoints()}
          tieGroups={tieGroups}
          onResolveTies={ids => onUpdateTournament(tournament.withManualOrder(ids))}
        />
      )}
      <button
        className="button button-primary"
        onClick={() => setConfirmingReset(true)}
        data-testid="new-tournament-button"
      >
        {t('tournament.actions.startNew')}
      </button>
      <ConfirmModal
        isOpen={confirmingReset}
        title={t('tournament.resetModal.title')}
        message={t('tournament.resetModal.message')}
        confirmText={t('tournament.resetModal.confirm')}
        cancelText={t('tournament.resetModal.cancel')}
        isDestructive
        onConfirm={() => { setConfirmingReset(false); onReset(); }}
        onCancel={() => setConfirmingReset(false)}
      />
    </div>
  );
};

