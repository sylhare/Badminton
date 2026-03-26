import React, { useState } from 'react';

import type { Player } from '../../types';
import type { TournamentFormat, TournamentTeam, TournamentType } from '../../tournament/types';
import { Tournament as TournamentBase } from '../../tournament/Tournament';
import { RoundRobinTournament } from '../../tournament/RoundRobinTournament';
import { EliminationTournament } from '../../tournament/EliminationTournament';

import { RoundRobinMatches } from './round-robin/RoundRobinMatches';
import { TournamentSetup } from './round-robin/TournamentSetup';
import { EliminationBracket } from './elimination/EliminationBracket';
import { TournamentStandings } from './TournamentStandings';

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

function standingsSubtitle(t: TournamentBase, isComplete: boolean): string {
  if (t.state().type === 'elimination') {
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
}) => {
  const [selectedType, setSelectedType] = useState<TournamentType>('round-robin');

  if (!tournament || tournament.phase() === 'setup') {
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
          onStart={(teams, courts, format) => onStart(teams, courts, format, selectedType)}
          onAddPlayers={onAddPlayers}
          onTogglePlayer={onTogglePlayer}
        />
      </div>
    );
  }

  const isComplete = tournament.isComplete();

  return (
    <div className="tournament-active-layout">
      {tournament.state().type === 'elimination'
        ? <EliminationBracket tournament={tournament as EliminationTournament} onMatchResult={onMatchResult} />
        : <RoundRobinMatches tournament={tournament as RoundRobinTournament} onMatchResult={onMatchResult} />
      }
      <TournamentStandings
        standings={tournament.calculateStandings()}
        isComplete={isComplete}
        subtitle={standingsSubtitle(tournament, isComplete)}
        showPoints={tournament.state().type !== 'elimination'}
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

