import React, { useState } from 'react';

import type { Player } from '../../types';
import type { TournamentFormat, TournamentTeam, TournamentType } from '../../tournament/types';
import { RoundRobinTournament } from '../../tournament/RoundRobinTournament';
import { EliminationTournament } from '../../tournament/EliminationTournament';

import RoundRobinMatches from './round-robin/RoundRobinMatches';
import RoundRobinSetup from './round-robin/RoundRobinSetup';
import RoundRobinStandings from './round-robin/RoundRobinStandings';
import EliminationBracket from './elimination/EliminationBracket';
import EliminationStandings from './elimination/EliminationStandings';

interface TournamentProps {
  tournament: RoundRobinTournament | EliminationTournament | null;
  initialPlayers: Player[];
  initialNumberOfCourts: number;
  onStart: (
    teams: TournamentTeam[],
    numberOfCourts: number,
    format: TournamentFormat,
    type: TournamentType,
  ) => void;
  onMatchResult: (matchId: string, winner: 1 | 2, score?: { team1: number; team2: number }) => void;
  onReset: () => void;
  onAddPlayers: (names: string[]) => void;
  onTogglePlayer: (id: string) => void;
}

const Tournament: React.FC<TournamentProps> = ({
  tournament,
  initialPlayers,
  initialNumberOfCourts,
  onStart,
  onMatchResult,
  onReset,
  onAddPlayers,
  onTogglePlayer,
}) => {
  const [selectedType, setSelectedType] = useState<TournamentType>('round-robin');

  if (!tournament || tournament.phase() === 'setup') {
    return (
      <div className="tournament-setup-wrapper">
        <div className="tournament-type-selector setup-section" data-testid="tournament-type-selector">
          <label className="setup-label">Tournament Type</label>
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
        <RoundRobinSetup
          initialPlayers={initialPlayers}
          initialNumberOfCourts={initialNumberOfCourts}
          onStart={(teams, courts, format) => onStart(teams, courts, format, selectedType)}
          onAddPlayers={onAddPlayers}
          onTogglePlayer={onTogglePlayer}
        />
      </div>
    );
  }

  if (tournament.state().type === 'elimination') {
    const elim = tournament as EliminationTournament;
    const standings = elim.calculateStandings();
    const isComplete = elim.isComplete();

    return (
      <div className="tournament-active-layout">
        <EliminationBracket tournament={elim} onMatchResult={onMatchResult} />
        <EliminationStandings standings={standings} isComplete={isComplete} />
        <button
          className="button button-primary"
          onClick={onReset}
          data-testid="new-tournament-button"
        >
          Start a New Tournament
        </button>
      </div>
    );
  }

  // Round Robin
  const rr = tournament as RoundRobinTournament;
  const standings = rr.calculateStandings();
  const completedRounds = rr.completedRounds();
  const totalRounds = rr.totalRounds();
  const isFinal = totalRounds > 0 && completedRounds === totalRounds;

  return (
    <div className="tournament-active-layout">
      <RoundRobinMatches tournament={rr} onMatchResult={onMatchResult} />
      <RoundRobinStandings
        standings={standings}
        currentRound={completedRounds}
        totalRounds={totalRounds}
        isFinal={isFinal}
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

export default Tournament;
