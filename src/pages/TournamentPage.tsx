import React, { useEffect, useState } from 'react';

import EliminationBracket from '../components/tournament/bracket/EliminationBracket';
import TournamentMatches from '../components/tournament/TournamentMatches';
import TournamentSetup from '../components/tournament/TournamentSetup';
import TournamentStandings from '../components/tournament/TournamentStandings';
import type { Court, Player } from '../types';
import { engine } from '../engines/engineSelector';
import { PlayersProvider } from '../hooks/usePlayers';
import { levelTracker } from '../engines/LevelTracker';
import Tournament from '../tournament/Tournament';
import { storageManager } from '../utils/StorageManager';
import './TournamentPage.css';

function TournamentPage(): React.ReactElement {
  const [players, setPlayers] = useState<Player[]>([]);
  const [initialNumberOfCourts, setInitialNumberOfCourts] = useState(4);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    Promise.all([storageManager.loadApp(), storageManager.loadTournament()]).then(
      ([appState, savedTournament]) => {
        if (appState.players) setPlayers(appState.players);
        if (appState.numberOfCourts !== undefined) setInitialNumberOfCourts(appState.numberOfCourts);
        if (savedTournament) {
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

  const handlePlayersAdded = (newPlayers: Player[]) => {
    setPlayers(prev => {
      const merged = [...prev, ...newPlayers];
      storageManager.loadApp().then(appState =>
        storageManager.saveApp({ ...appState, players: merged }),
      );
      return merged;
    });
  };

  const handleMatchResult = (
    matchId: string,
    winner: 1 | 2,
    score?: { team1: number; team2: number },
  ) => {
    if (!tournament) return;

    const newTournament = tournament.recordResult(matchId, winner, score);

    const match = tournament.toState().matches.find(m => m.id === matchId);
    if (match) {
      const getPlayers = (ids: string[]) => ids.map(id => players.find(p => p.id === id)!).filter(Boolean);
      const court: Court = {
        courtNumber: match.courtNumber,
        players: [...getPlayers(match.team1.playerIds), ...getPlayers(match.team2.playerIds)],
        teams: { team1: getPlayers(match.team1.playerIds), team2: getPlayers(match.team2.playerIds) },
        winner,
        score,
      };
      const updatedPlayers = levelTracker.updatePlayersLevels([court], players);
      engine().recordLevelSnapshot(updatedPlayers);
      setTournament(newTournament);
      setPlayers(updatedPlayers);
      storageManager.loadApp().then(appState =>
        storageManager.saveApp({ ...appState, players: updatedPlayers }),
      );
    } else {
      setTournament(newTournament);
    }
  };

  const handleReset = () => {
    setTournament(null);
  };

  let content: React.ReactNode;

  if (!tournament) {
    content = (
      <TournamentSetup
        initialPlayers={players}
        initialNumberOfCourts={initialNumberOfCourts}
        onStart={handleStart}
        onPlayersAdded={handlePlayersAdded}
      />
    );
  } else {
    const standings = tournament.getStandings(players);
    const completedRounds = tournament.getCompletedRounds();
    const totalRounds = tournament.getTotalRounds();
    const isFinal = tournament.isComplete();
    const { type: tournamentType, matches } = tournament.toState();
    const { currentRound, roundNums } = tournament.roundInfo();

    content = (
      <PlayersProvider value={players}>
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
              currentRound={currentRound}
              roundNums={roundNums}
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
      </PlayersProvider>
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
