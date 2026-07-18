import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { Player } from '../../types';
import type { TournamentFormat, TournamentTeam } from '../../tournament/types';
import { formatTeamName } from '../../tournament/types';
import { RoundRobinTournament } from '../../tournament/RoundRobinTournament';
import type { SlotAddr } from '../../utils/slotSwap';
import { swapInGroups } from '../../utils/slotSwap';
import { useSlotSwap } from '../../hooks/useSlotSwap';
import ManualPlayerEntry from '../players/ManualPlayerEntry';

interface TournamentSetupProps {
  initialPlayers: Player[];
  initialNumberOfCourts: number;
  onStart: (teams: TournamentTeam[], numberOfCourts: number, format: TournamentFormat) => void;
  onAddPlayers?: (names: string[]) => void;
  onTogglePlayer?: (id: string) => void;
}

export const TournamentSetup: React.FC<TournamentSetupProps> = ({
  initialPlayers,
  initialNumberOfCourts,
  onStart,
  onAddPlayers,
  onTogglePlayer,
}) => {
  const [format, setFormat] = useState<TournamentFormat>('doubles');
  const [numberOfCourts, setNumberOfCourts] = useState(initialNumberOfCourts);
  const [teams, setTeams] = useState<TournamentTeam[]>(() =>
    RoundRobinTournament.createTeams(initialPlayers.filter(p => p.isPresent), 'doubles'),
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
    () => RoundRobinTournament.create(format, numberOfCourts),
    [format, numberOfCourts],
  );
  const validationError = tournament.validate(teams, format);
  const matchesPerRound = RoundRobinTournament.matchesPerRound(teams);
  const courtWarning =
    !validationError && matchesPerRound > numberOfCourts
      ? `${matchesPerRound} matches per round but only ${numberOfCourts} court${numberOfCourts > 1 ? 's' : ''} — some matches will need to wait.`
      : null;

  const handleStart = () => {
    if (validationError) return;
    onStart(teams, numberOfCourts, format);
  };

  return (
    <div className="tournament-setup">
      {swap.dragGhost}
      <div className="setup-section">
        <h3>Format</h3>
        <div className="format-pills" data-testid="format-pills">
          {(['doubles', 'singles'] as TournamentFormat[]).map(f => (
            <button
              key={f}
              className={`format-pill${format === f ? ' format-pill-active' : ''}`}
              onClick={() => setFormat(f)}
              data-testid={`format-pill-${f}`}
            >
              {f === 'singles' ? 'Singles (1v1)' : 'Doubles (2v2)'}
            </button>
          ))}
        </div>
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
        <input
          type="number"
          min="1"
          value={numberOfCourts}
          onChange={e => setNumberOfCourts(Math.max(1, parseInt(e.target.value, 10) || 1))}
          className="court-count-input"
          data-testid="tournament-court-count"
        />
      </div>

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
        disabled={!!validationError || teams.length === 0}
        data-testid="start-tournament-button"
      >
        Start Tournament
      </button>
    </div>
  );
};

