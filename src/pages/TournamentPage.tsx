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
    Promise.all([storageManager.loadApp(), storageManager.loadTournament()]).then(
      ([appState, savedTournament]) => {
        if (appState.players) setInitialPlayers(appState.players);
        if (appState.numberOfCourts !== undefined) setInitialNumberOfCourts(appState.numberOfCourts);
        if (savedTournament) setTournamentState(savedTournament);
        setIsLoaded(true);
      },
    );
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    storageManager.saveTournament(tournamentState);
  }, [tournamentState, isLoaded]);

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

  const handleReset = () => {
    setTournamentState(null);
  };

  let content: React.ReactNode;

  if (!tournamentState || tournamentState.phase === 'setup') {
    content = (
      <TournamentSetup
        initialPlayers={initialPlayers}
        initialNumberOfCourts={initialNumberOfCourts}
        onStart={handleStart}
      />
    );
  } else {
    const standings = calculateStandings(tournamentState.teams, tournamentState.matches);
    const completedRounds = getCompletedRounds(tournamentState.matches);
    const totalRounds = getTotalRounds(tournamentState.matches);
    const isFinal = totalRounds > 0 && completedRounds === totalRounds;

    content = (
      <div className="tournament-active-layout">
        <TournamentMatches
          matches={tournamentState.matches}
          onMatchResult={handleMatchResult}
        />
        <TournamentStandings
          standings={standings}
          currentRound={completedRounds}
          totalRounds={totalRounds}
          isFinal={isFinal}
        />
        <button
          className="button button-primary"
          onClick={handleReset}
          data-testid="new-tournament-button"
        >
          Start a New Tournament
        </button>
      </div>
    );
  }

  return (
    <div className="app tournament-page" data-loaded={isLoaded}>
      <div className="container main-container">
        <h1><span className="title-emoji">🏆 </span>Tournament</h1>
        {content}
      </div>
    </div>
  );
}

export default TournamentPage;
