import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { Player } from '../../types';
import type { TournamentFormat, TournamentTeam, TournamentType } from '../../tournament/types';
import { DEFAULT_SET_SIZE, formatTeamName } from '../../tournament/types';
import type { CreateTournamentOptions } from '../../tournament/tournamentFactory';
import { RoundRobinTournament } from '../../tournament/RoundRobinTournament';
import type { SlotAddr } from '../../utils/slotSwap';
import { swapInGroups } from '../../utils/slotSwap';
import { useSlotSwap } from '../../hooks/useSlotSwap';
import ManualPlayerEntry from '../players/ManualPlayerEntry';
import { SegmentedControl } from '../common/SegmentedControl';
import { NumberField } from '../common/NumberField';

import { TOURNAMENT_KINDS } from './tournamentKinds';

const BEST_OF_OPTIONS = [1, 3, 5];

interface TournamentSetupProps {
  initialPlayers: Player[];
  initialNumberOfCourts: number;
  type?: TournamentType;
  /** Settings of the current tournament, used to pre-fill the form when re-opening setup. */
  initialConfig?: Partial<CreateTournamentOptions>;
  onStart: (teams: TournamentTeam[], options: CreateTournamentOptions) => void;
  onAddPlayers?: (names: string[]) => void;
  onTogglePlayer?: (id: string) => void;
}

export const TournamentSetup: React.FC<TournamentSetupProps> = ({
  initialPlayers,
  initialNumberOfCourts,
  type = 'round-robin',
  initialConfig,
  onStart,
  onAddPlayers,
  onTogglePlayer,
}) => {
  const [format, setFormat] = useState<TournamentFormat>(initialConfig?.format ?? 'doubles');
  const [numberOfCourts, setNumberOfCourts] = useState(initialConfig?.numberOfCourts ?? initialNumberOfCourts);
  const [bestOf, setBestOf] = useState(initialConfig?.bestOf ?? 1);
  const [setSize, setSetSize] = useState(initialConfig?.setSize ?? DEFAULT_SET_SIZE);
  const [groupSize, setGroupSize] = useState(initialConfig?.groupSize ?? 4);
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(initialConfig?.qualifiersPerGroup ?? 2);
  const [teams, setTeams] = useState<TournamentTeam[]>(() =>
    RoundRobinTournament.createTeams(initialPlayers.filter(p => p.isPresent), initialConfig?.format ?? 'doubles'),
  );

  const handleSwap = useCallback((from: SlotAddr, to: SlotAddr) => {
    setTeams(prev => {
      const groups = prev.map(t => t.players);
      const swapped = swapInGroups(groups, from, to);
      if (swapped === groups) return prev;
      return prev.map((team, i) => ({ ...team, players: swapped[i] }));
    });
  }, []);

  const swap = useSlotSwap({
    onSwap: handleSwap,
    enabled: format === 'doubles',
    touch: 'tap',
  });
  const { clearSelection } = swap;

  useEffect(() => {
    setTeams(RoundRobinTournament.createTeams(initialPlayers.filter(p => p.isPresent), format));
    clearSelection();
  }, [initialPlayers, format, clearSelection]);

  const tournament = useMemo(
    () => RoundRobinTournament.create({ format, numberOfCourts }),
    [format, numberOfCourts],
  );
  const kind = TOURNAMENT_KINDS[type];
  const setupConfig = { groupSize, qualifiersPerGroup, setGroupSize, setQualifiersPerGroup };

  const validationError = tournament.validate(teams, format);
  const matchesPerRound = kind.matchesPerRound?.(teams, setupConfig)
    ?? RoundRobinTournament.matchesPerRound(teams);
  const courtWarning =
    !validationError && matchesPerRound > numberOfCourts
      ? `${matchesPerRound} matches per round but only ${numberOfCourts} court${numberOfCourts > 1 ? 's' : ''} — some matches will need to wait.`
      : null;

  const setupIssues = kind.validateSetup?.(teams, setupConfig) ?? { error: null, warning: null };
  const qualifierError = setupIssues.error;

  const handleStart = () => {
    if (validationError || qualifierError) return;
    onStart(teams, { type, format, numberOfCourts, bestOf, setSize, groupSize, qualifiersPerGroup });
  };

  return (
    <div className="tournament-setup">
      {swap.dragGhost}
      <div className="setup-section">
        <h3>Format</h3>
        <SegmentedControl
          options={['doubles', 'singles'] as TournamentFormat[]}
          selected={format}
          onSelect={setFormat}
          label={f => (f === 'singles' ? 'Singles (1v1)' : 'Doubles (2v2)')}
          testIdFor={f => `format-pill-${f}`}
          containerTestId="format-pills"
        />
      </div>

      <div className="setup-section">
        <h3>Players</h3>
        <div className="tournament-player-entry">
          <ManualPlayerEntry onPlayersAdded={names => onAddPlayers?.(names)} />
        </div>
        <div className="player-selection" data-testid="player-selection">
          {initialPlayers.map(player => (
            <label key={player.id} className="player-checkbox-label">
              <input
                type="checkbox"
                checked={player.isPresent}
                onChange={() => onTogglePlayer?.(player.id)}
                data-testid={`player-checkbox-${player.id}`}
              />
              {player.name}
            </label>
          ))}
        </div>
      </div>

      <div className="setup-section">
        <h3>Number of Courts</h3>
        <NumberField value={numberOfCourts} min={1} onChange={setNumberOfCourts} testId="tournament-court-count" />
      </div>

      <div className="setup-section">
        <h3>Sets per Match</h3>
        <SegmentedControl
          options={BEST_OF_OPTIONS}
          selected={bestOf}
          onSelect={setBestOf}
          label={n => (n === 1 ? 'Single game' : `Best of ${n}`)}
          testIdFor={n => `best-of-pill-${n}`}
          containerTestId="best-of-pills"
        />
        <label className="set-size-field">
          Points per set
          <NumberField value={setSize} min={1} onChange={setSetSize} testId="set-size-input" />
        </label>
      </div>

      {kind.renderSetupConfig?.(setupConfig, setupIssues, teams)}

      {teams.length > 0 && (
        <div className="setup-section">
          <h3>Teams</h3>
          {format === 'doubles' && (
            <p className="setup-hint">Drag a player onto another to swap them — or tap two players.</p>
          )}
          <div className="teams-grid" data-testid="teams-grid">
            {teams.map((team, teamIdx) => (
              <div key={team.id} className="team-card" data-testid={`team-card-${teamIdx}`}>
                <div className="team-card-title">Team {teamIdx + 1}</div>
                {format === 'doubles' ? (
                  <div className="team-players-slots">
                    {(() => {
                      const binding = swap.binding(index => ({ group: teamIdx, index }));
                      return team.players.map((player, playerIdx) => {
                        const stateCls = binding.stateClass(playerIdx);
                        return (
                          <div
                            key={player.id}
                            className={`player-slot player-slot-draggable${stateCls ? ` ${stateCls}` : ''}`}
                            data-testid={`player-slot-${teamIdx}-${playerIdx}`}
                            {...binding.getProps(playerIdx)}
                          >
                            {player.name}
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div className="team-players-slots">
                    <div className="player-slot" data-testid={`player-slot-${teamIdx}-0`}>
                      {formatTeamName(team)}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {validationError && (
        <p className="setup-error" data-testid="setup-error">{validationError}</p>
      )}
      {courtWarning && (
        <p className="setup-warning" data-testid="court-warning">{courtWarning}</p>
      )}

      <button
        className="button button-primary"
        onClick={handleStart}
        disabled={!!validationError || teams.length === 0 || !!qualifierError}
        data-testid="start-tournament-button"
      >
        Start Tournament
      </button>
    </div>
  );
};

