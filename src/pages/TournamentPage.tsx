import React, { useEffect, useState } from 'react';

import TournamentMatches from '../components/tournament/TournamentMatches';
import TournamentSetup from '../components/tournament/TournamentSetup';
import TournamentStandings from '../components/tournament/TournamentStandings';
import type { Player } from '../types';
import type { TournamentState } from '../types/tournament';
import { calculateStandings, getCompletedRounds, getTotalRounds } from '../utils/tournamentUtils';
import { storageManager } from '../utils/StorageManager';
import './TournamentPage.css';

function TournamentPage(): React.ReactElement {
  const [initialPlayers, setInitialPlayers] = useState<Player[]>([]);
  const [initialNumberOfCourts, setInitialNumberOfCourts] = useState(4);
  const [tournamentState, setTournamentState] = useState<TournamentState | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    storageManager.loadApp().then(state => {
      if (state.players) {
        setInitialPlayers(state.players.filter(p => p.isPresent));
      }
      if (state.numberOfCourts !== undefined) {
        setInitialNumberOfCourts(state.numberOfCourts);
      }
      setIsLoaded(true);
    });
  }, []);

  const handleStart = (state: TournamentState) => {
    setTournamentState(state);
  };

  const handleMatchResult = (
    matchId: string,
    winner: 1 | 2,
    score?: { team1: number; team2: number },
  ) => {
    setTournamentState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        matches: prev.matches.map(m =>
          m.id === matchId ? { ...m, winner, score: score ?? m.score } : m,
        ),
      };
    });
  };

  const handleComplete = () => {
    setTournamentState(prev => (prev ? { ...prev, phase: 'completed' } : prev));
  };

  const handleReset = () => {
    setTournamentState(null);
  };

  const basePath = import.meta.env.BASE_URL || '/';

  let content: React.ReactNode;

  if (!tournamentState || tournamentState.phase === 'setup') {
    content = (
      <TournamentSetup
        initialPlayers={initialPlayers}
        initialNumberOfCourts={initialNumberOfCourts}
        onStart={handleStart}
      />
    );
  } else if (tournamentState.phase === 'active') {
    const standings = calculateStandings(tournamentState.teams, tournamentState.matches);
    const completedRounds = getCompletedRounds(tournamentState.matches);
    const totalRounds = getTotalRounds(tournamentState.matches);

    content = (
      <div className="tournament-active-layout">
        <TournamentMatches
          matches={tournamentState.matches}
          onMatchResult={handleMatchResult}
          onComplete={handleComplete}
        />
        <TournamentStandings
          standings={standings}
          currentRound={completedRounds}
          totalRounds={totalRounds}
          isComplete={false}
        />
      </div>
    );
  } else {
    const standings = calculateStandings(tournamentState.teams, tournamentState.matches);
    const totalRounds = getTotalRounds(tournamentState.matches);

    content = (
      <TournamentStandings
        standings={standings}
        currentRound={totalRounds}
        totalRounds={totalRounds}
        isComplete={true}
        onReset={handleReset}
      />
    );
  }

  return (
    <div className="app tournament-page" data-loaded={isLoaded}>
      <div className="container main-container">
        <h1>🏆 Tournament Mode</h1>
        <a
          href={basePath}
          className="back-link"
          data-testid="back-to-app"
        >
          ← Back to Court Manager
        </a>
        {content}
      </div>
    </div>
  );
}

export default TournamentPage;
