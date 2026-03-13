import React, { useEffect, useState } from 'react';

import type { Player } from '../../types';
import type { TournamentFormat, TournamentState, TournamentTeam } from '../../types/tournament';
import {
  autoCreateDoubleTeams,
  autoCreateSingleTeams,
  generateRoundRobinMatches,
  validateTeams,
} from '../../utils/tournamentUtils';

interface TournamentSetupProps {
  initialPlayers: Player[];
  initialNumberOfCourts: number;
  onStart: (state: TournamentState) => void;
}

interface SwapSelection {
  teamIdx: number;
  playerIdx: number;
}

function deriveTeams(players: Player[], format: TournamentFormat): TournamentTeam[] {
  if (format === 'singles') return autoCreateSingleTeams(players);
  return autoCreateDoubleTeams(players);
}

const TournamentSetup: React.FC<TournamentSetupProps> = ({
  initialPlayers,
  initialNumberOfCourts,
  onStart,
}) => {
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(
    () => new Set(initialPlayers.map(p => p.id)),
  );
  const [format, setFormat] = useState<TournamentFormat>('doubles');
  const [numberOfCourts, setNumberOfCourts] = useState(initialNumberOfCourts);
  const [teams, setTeams] = useState<TournamentTeam[]>(() =>
    deriveTeams(initialPlayers, 'doubles'),
  );
  const [swapSelection, setSwapSelection] = useState<SwapSelection | null>(null);

  const selectedPlayers = initialPlayers.filter(p => selectedPlayerIds.has(p.id));

  // Sync when initialPlayers loads asynchronously (e.g., from StorageManager)
  useEffect(() => {
    if (initialPlayers.length > 0) {
      setSelectedPlayerIds(new Set(initialPlayers.map(p => p.id)));
    }
  // Intentionally only re-run when initialPlayers reference changes (initial load)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPlayers]);

  useEffect(() => {
    setTeams(deriveTeams(selectedPlayers, format));
    setSwapSelection(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlayerIds, format]);

  const handleFormatChange = (f: TournamentFormat) => {
    setFormat(f);
  };

  const handlePlayerToggle = (id: string) => {
    setSelectedPlayerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handlePlayerSlotClick = (teamIdx: number, playerIdx: number) => {
    if (swapSelection === null) {
      setSwapSelection({ teamIdx, playerIdx });
      return;
    }

    if (swapSelection.teamIdx === teamIdx && swapSelection.playerIdx === playerIdx) {
      setSwapSelection(null);
      return;
    }

    setTeams(prev => {
      const next = prev.map(t => ({ ...t, players: [...t.players] }));
      const fromTeam = next[swapSelection.teamIdx];
      const toTeam = next[teamIdx];
      if (!fromTeam || !toTeam) return prev;

      const fromPlayer = fromTeam.players[swapSelection.playerIdx];
      const toPlayer = toTeam.players[playerIdx];
      if (!fromPlayer || !toPlayer) return prev;

      fromTeam.players[swapSelection.playerIdx] = toPlayer;
      toTeam.players[playerIdx] = fromPlayer;

      return next;
    });
    setSwapSelection(null);
  };

  const validationError = validateTeams(teams, format);

  const handleStart = () => {
    if (validationError) return;
    const matches = generateRoundRobinMatches(teams, numberOfCourts);
    onStart({
      phase: 'active',
      format,
      type: 'round-robin',
      numberOfCourts,
      teams,
      matches,
    });
  };

  const teamPlayerName = (team: TournamentTeam) =>
    team.players.map(p => p.name).join(' & ');

  return (
    <div className="tournament-setup">
      <h2>Tournament Setup</h2>

      <div className="setup-section">
        <h3>Format</h3>
        <div className="format-pills" data-testid="format-pills">
          {(['doubles', 'singles'] as TournamentFormat[]).map(f => (
            <button
              key={f}
              className={`format-pill${format === f ? ' format-pill-active' : ''}`}
              onClick={() => handleFormatChange(f)}
              data-testid={`format-pill-${f}`}
            >
              {f === 'singles' ? 'Singles (1v1)' : 'Doubles (2v2)'}
            </button>
          ))}
        </div>
      </div>

      <div className="setup-section">
        <h3>Players</h3>
        <div className="player-selection" data-testid="player-selection">
          {initialPlayers.map(player => (
            <label key={player.id} className="player-checkbox-label">
              <input
                type="checkbox"
                checked={selectedPlayerIds.has(player.id)}
                onChange={() => handlePlayerToggle(player.id)}
                data-testid={`player-checkbox-${player.id}`}
              />
              {player.name}
            </label>
          ))}
        </div>
        {initialPlayers.length === 0 && (
          <p className="setup-hint">No present players found. Add players on the main page first.</p>
        )}
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
            <p className="setup-hint">Click two player slots to swap them between teams.</p>
          )}
          <div className="teams-grid" data-testid="teams-grid">
            {teams.map((team, teamIdx) => (
              <div key={team.id} className="team-card" data-testid={`team-card-${teamIdx}`}>
                <div className="team-card-title">Team {teamIdx + 1}</div>
                {format === 'doubles' ? (
                  <div className="team-players-slots">
                    {team.players.map((player, playerIdx) => {
                      const isSelected =
                        swapSelection?.teamIdx === teamIdx &&
                        swapSelection?.playerIdx === playerIdx;
                      return (
                        <div
                          key={player.id}
                          className={`player-slot${isSelected ? ' swap-selected' : ''}`}
                          onClick={() => handlePlayerSlotClick(teamIdx, playerIdx)}
                          data-testid={`player-slot-${teamIdx}-${playerIdx}`}
                        >
                          {player.name}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="team-players-slots">
                    <div className="player-slot" data-testid={`player-slot-${teamIdx}-0`}>
                      {teamPlayerName(team)}
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

export default TournamentSetup;
