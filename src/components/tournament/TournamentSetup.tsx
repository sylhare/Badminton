import React, { useEffect, useState } from 'react';

import type { Player } from '../../types';
import type { TournamentFormat, TournamentTeam, TournamentType } from '../../types/tournament';
import ManualPlayerEntry from '../players/ManualPlayerEntry';
import Tournament from '../../utils/Tournament';

interface TournamentSetupProps {
  initialPlayers: Player[];
  initialNumberOfCourts: number;
  onStart: (tournament: Tournament) => void;
  onPlayersAdded?: (players: Player[]) => void;
}

interface SwapSelection {
  teamIdx: number;
  playerIdx: number;
}

function deriveTeams(players: Player[], format: TournamentFormat): TournamentTeam[] {
  if (format === 'singles') return Tournament.createSingleTeams(players);
  return Tournament.createDoubleTeams(players);
}

function makeTeamId(index: number): string {
  return `team-${Date.now()}-${index}`;
}

function makePlayerId(): string {
  return `tournament-player-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function insertPlayer(teams: TournamentTeam[], player: Player, format: TournamentFormat): TournamentTeam[] {
  const next = teams.map(t => ({ ...t, players: [...t.players] }));
  if (format === 'singles') {
    next.push({ id: makeTeamId(next.length), players: [player] });
  } else {
    const incomplete = next.find(t => t.players.length < 2);
    if (incomplete) {
      incomplete.players.push(player);
    } else {
      next.push({ id: makeTeamId(next.length), players: [player] });
    }
  }
  return next;
}

const TournamentSetup: React.FC<TournamentSetupProps> = ({
  initialPlayers,
  initialNumberOfCourts,
  onStart,
  onPlayersAdded,
}) => {
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(
    () => new Set(initialPlayers.filter(p => p.isPresent).map(p => p.id)),
  );
  const [tournamentType, setTournamentType] = useState<TournamentType>('round-robin');
  const [format, setFormat] = useState<TournamentFormat>('doubles');
  const [numberOfCourts, setNumberOfCourts] = useState(initialNumberOfCourts);
  const [teams, setTeams] = useState<TournamentTeam[]>(() =>
    deriveTeams(initialPlayers.filter(p => p.isPresent), 'doubles'),
  );
  const [swapSelection, setSwapSelection] = useState<SwapSelection | null>(null);

  const selectedPlayers = initialPlayers.filter(p => selectedPlayerIds.has(p.id));

  useEffect(() => {
    if (initialPlayers.length > 0) {
      const presentIds = new Set(initialPlayers.filter(p => p.isPresent).map(p => p.id));
      setSelectedPlayerIds(prev => {
        const next = new Set(presentIds);
        for (const id of prev) {
          if (!initialPlayers.some(p => p.id === id)) next.add(id);
        }
        return next;
      });
      setTeams(deriveTeams(initialPlayers.filter(p => p.isPresent), format));
      setSwapSelection(null);
    }
  }, [initialPlayers]);

  useEffect(() => {
    setTeams(deriveTeams(selectedPlayers, format));
    setSwapSelection(null);
  }, [format]);

  const handleFormatChange = (f: TournamentFormat) => {
    setFormat(f);
  };

  const handlePlayersAdded = (names: string[]) => {
    const newPlayers: Player[] = names.map(name => ({ id: makePlayerId(), name, isPresent: true }));
    setSelectedPlayerIds(prev => new Set([...prev, ...newPlayers.map(p => p.id)]));
    setTeams(prev => newPlayers.reduce((acc, p) => insertPlayer(acc, p, format), prev));
    onPlayersAdded?.(newPlayers);
  };

  const handlePlayerToggle = (id: string) => {
    const isRemoving = selectedPlayerIds.has(id);
    const player = initialPlayers.find(p => p.id === id);
    if (!player) return;

    setSelectedPlayerIds(prev => {
      const next = new Set(prev);
      if (isRemoving) next.delete(id);
      else next.add(id);
      return next;
    });

    setSwapSelection(null);

    if (isRemoving) {
      setTeams(prev => {
        let next = prev
          .map(t => ({ ...t, players: t.players.filter(p => p.id !== id) }))
          .filter(t => t.players.length > 0);

        if (format === 'doubles') {
          const soloIndices = next
            .map((t, i) => (t.players.length === 1 ? i : -1))
            .filter(i => i >= 0);
          const toRemove = new Set<number>();
          for (let i = 0; i + 1 < soloIndices.length; i += 2) {
            const a = soloIndices[i];
            const b = soloIndices[i + 1];
            next[a] = { ...next[a], players: [...next[a].players, ...next[b].players] };
            toRemove.add(b);
          }
          if (toRemove.size > 0) next = next.filter((_, i) => !toRemove.has(i));
        }

        return next;
      });
    } else {
      setTeams(prev => insertPlayer(prev, player, format));
    }
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

  const validationError = Tournament.validate(teams, format);
  const matchesPerRound = Math.floor(teams.length / 2);
  const courtWarning =
    !validationError && matchesPerRound > numberOfCourts
      ? `${matchesPerRound} matches per round but only ${numberOfCourts} court${numberOfCourts > 1 ? 's' : ''} — some matches will need to wait.`
      : null;

  const handleStart = () => {
    if (validationError) return;
    onStart(Tournament.start(teams, numberOfCourts, format, tournamentType));
  };

  return (
    <div className="tournament-setup">
      <div className="setup-section">
        <h3>Tournament Type</h3>
        <div className="format-pills" data-testid="tournament-type-pills">
          {(['round-robin', 'elimination'] as TournamentType[]).map(t => (
            <button
              key={t}
              className={`format-pill${tournamentType === t ? ' format-pill-active' : ''}`}
              onClick={() => setTournamentType(t)}
              data-testid={`tournament-type-pill-${t}`}
            >
              {t === 'round-robin' ? 'Round Robin' : 'Elimination'}
            </button>
          ))}
        </div>
      </div>

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
        <div className="tournament-player-entry">
          <ManualPlayerEntry onPlayersAdded={handlePlayersAdded} />
        </div>
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
                      {Tournament.formatTeamName(team)}
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

export default TournamentSetup;
