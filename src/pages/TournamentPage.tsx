import React, { useEffect, useState } from 'react';

import { storageManager } from '../utils/StorageManager';
import { useAppState } from '../providers/AppStateProvider';

import RoundRobinMatches from '../components/tournament/round-robin/RoundRobinMatches';
import RoundRobinSetup from '../components/tournament/round-robin/RoundRobinSetup';
import RoundRobinStandings from '../components/tournament/round-robin/RoundRobinStandings';
import { RoundRobinTournament } from '../tournament/RoundRobinTournament';
import type { TournamentFormat, TournamentTeam } from '../tournament/types';
import './TournamentPage.css';

function TournamentPage(): React.ReactElement {
  const { players, isLoaded, handleAddPlayers, handlePlayerToggle } = useAppState();
  const [initialNumberOfCourts, setInitialNumberOfCourts] = useState(4);
  const [tournament, setTournament] = useState<RoundRobinTournament | null>(null);
  const [isTournamentLoaded, setIsTournamentLoaded] = useState(false);

  useEffect(() => {
    Promise.all([storageManager.loadApp(), storageManager.loadTournament()]).then(
      ([appState, savedTournament]) => {
        if (appState.numberOfCourts !== undefined) setInitialNumberOfCourts(appState.numberOfCourts);
        if (savedTournament) setTournament(RoundRobinTournament.fromState(savedTournament));
        setIsTournamentLoaded(true);
      },
    );
  }, []);

  useEffect(() => {
    if (!isTournamentLoaded) return;
    storageManager.saveTournament(tournament?.getState() ?? null);
  }, [tournament, isTournamentLoaded]);

  const handleStart = (teams: TournamentTeam[], numberOfCourts: number, format: TournamentFormat) => {
    setTournament(RoundRobinTournament.create(format, numberOfCourts).start(teams, numberOfCourts));
  };

  const handleMatchResult = (
    matchId: string,
    winner: 1 | 2,
    score?: { team1: number; team2: number },
  ) => {
    setTournament(prev => prev?.withMatchResult(matchId, winner, score) ?? null);
  };

  const handleReset = () => {
    setTournament(null);
  };

  let content: React.ReactNode;

  if (!tournament || tournament.getPhase() === 'setup') {
    content = (
      <RoundRobinSetup
        initialPlayers={players}
        initialNumberOfCourts={initialNumberOfCourts}
        onStart={handleStart}
        onAddPlayers={handleAddPlayers}
        onTogglePlayer={handlePlayerToggle}
      />
    );
  } else {
    const standings = tournament.calculateStandings();
    const completedRounds = tournament.getCompletedRounds();
    const totalRounds = tournament.getTotalRounds();
    const isFinal = totalRounds > 0 && completedRounds === totalRounds;

    content = (
      <div className="tournament-active-layout">
        <RoundRobinMatches
          matches={tournament.getMatches()}
          onMatchResult={handleMatchResult}
        />
        <RoundRobinStandings
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
