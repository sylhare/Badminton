import React, { useEffect, useState } from 'react';

import EliminationBracket from '../components/tournament/bracket';
import TournamentMatches from '../components/tournament/TournamentMatches';
import TournamentSetup from '../components/tournament/TournamentSetup';
import TournamentStandings from '../components/tournament/TournamentStandings';
import type { Player } from '../types';
import Tournament from '../utils/Tournament';
import { storageManager } from '../utils/StorageManager';
import './TournamentPage.css';

function TournamentPage(): React.ReactElement {
  const [initialPlayers, setInitialPlayers] = useState<Player[]>([]);
  const [initialNumberOfCourts, setInitialNumberOfCourts] = useState(4);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    Promise.all([storageManager.loadApp(), storageManager.loadTournament()]).then(
      ([appState, savedTournament]) => {
        if (appState.players) setInitialPlayers(appState.players);
        if (appState.numberOfCourts !== undefined) setInitialNumberOfCourts(appState.numberOfCourts);
        // Discard stale double-elimination state (incompatible structure)
        if (savedTournament && (savedTournament.type as string) !== 'double-elimination') {
          setTournament(Tournament.from(savedTournament));
        }
        setIsLoaded(true);
      },
    );
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    storageManager.saveTournament(tournament?.toState() ?? null);
  }, [tournament, isLoaded]);

  const handleStart = (t: Tournament) => {
    setTournament(t);
  };

  const handleMatchResult = (
    matchId: string,
    winner: 1 | 2,
    score?: { team1: number; team2: number },
  ) => {
    setTournament(prev => prev?.recordResult(matchId, winner, score) ?? prev);
  };

  const handleReset = () => {
    setTournament(null);
  };

  let content: React.ReactNode;

  if (!tournament) {
    content = (
      <TournamentSetup
        initialPlayers={initialPlayers}
        initialNumberOfCourts={initialNumberOfCourts}
        onStart={handleStart}
      />
    );
  } else {
    const standings = tournament.getStandings();
    const completedRounds = tournament.getCompletedRounds();
    const totalRounds = tournament.getTotalRounds();
    const isFinal = tournament.isComplete();
    const { type: tournamentType, matches } = tournament.toState();

    content = (
      <div className="tournament-active-layout">
        {tournamentType === 'elimination' ? (
          <EliminationBracket
            matches={matches}
            teams={tournament.toState().teams}
            seBracket={tournament.toState().seBracket!}
            onMatchResult={handleMatchResult}
          />
        ) : (
          <TournamentMatches
            matches={matches}
            onMatchResult={handleMatchResult}
          />
        )}
        <TournamentStandings
          standings={standings}
          currentRound={completedRounds}
          totalRounds={totalRounds}
          isFinal={isFinal}
          tournamentType={tournamentType}
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
