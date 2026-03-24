import React from 'react';

import type { Player } from '../../types';
import { RoundRobinTournament } from '../../tournament/RoundRobinTournament';
import type { TournamentFormat, TournamentTeam } from '../../tournament/types';

import RoundRobinMatches from './round-robin/RoundRobinMatches';
import RoundRobinSetup from './round-robin/RoundRobinSetup';
import RoundRobinStandings from './round-robin/RoundRobinStandings';

interface TournamentProps {
  tournament: RoundRobinTournament | null;
  initialPlayers: Player[];
  initialNumberOfCourts: number;
  onStart: (teams: TournamentTeam[], numberOfCourts: number, format: TournamentFormat) => void;
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
  if (!tournament || tournament.phase() === 'setup') {
    return (
      <RoundRobinSetup
        initialPlayers={initialPlayers}
        initialNumberOfCourts={initialNumberOfCourts}
        onStart={onStart}
        onAddPlayers={onAddPlayers}
        onTogglePlayer={onTogglePlayer}
      />
    );
  }

  const standings = tournament.calculateStandings();
  const completedRounds = tournament.completedRounds();
  const totalRounds = tournament.totalRounds();
  const isFinal = totalRounds > 0 && completedRounds === totalRounds;

  return (
    <div className="tournament-active-layout">
      <RoundRobinMatches
        tournament={tournament}
        onMatchResult={onMatchResult}
      />
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
