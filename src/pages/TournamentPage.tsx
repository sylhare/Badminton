import React, { useEffect, useState } from 'react';

import EliminationBracket from '../components/tournament/bracket/EliminationBracket';
import TournamentMatches from '../components/tournament/TournamentMatches';
import TournamentSetup from '../components/tournament/TournamentSetup';
import TournamentStandings from '../components/tournament/TournamentStandings';
import type { Court } from '../types';
import { useAppState } from '../hooks/usePlayers';
import Tournament from '../tournament/Tournament';
import { storageManager } from '../utils/StorageManager';
import './TournamentPage.css';

function TournamentPage(): React.ReactElement {
  const { players, isLoaded, handlePlayerToggle, handleAddPlayers, applyCourtResults } = useAppState();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isTournamentLoaded, setIsTournamentLoaded] = useState(false);

  useEffect(() => {
    storageManager.loadTournament().then(savedTournament => {
      if (savedTournament) {
        setTournament(Tournament.from(savedTournament));
      }
      setIsTournamentLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!isLoaded || !isTournamentLoaded) return;
    storageManager.saveTournament(tournament?.toState() ?? null);
  }, [tournament, isLoaded, isTournamentLoaded]);

  const handleStart = (t: Tournament) => {
    setTournament(t);
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
      applyCourtResults([court]);
    }

    setTournament(newTournament);
  };

  const handleReset = () => {
    setTournament(null);
  };

  let content: React.ReactNode;

  if (!tournament && isLoaded && isTournamentLoaded) {
    content = (
      <TournamentSetup
        initialPlayers={players}
        initialNumberOfCourts={4}
        onStart={handleStart}
        onTogglePlayer={handlePlayerToggle}
        onAddPlayers={handleAddPlayers}
      />
    );
  } else if (!tournament) {
    content = null;
  } else {
    const standings = tournament.getStandings(players);
    const completedRounds = tournament.getCompletedRounds();
    const totalRounds = tournament.getTotalRounds();
    const isFinal = tournament.isComplete();
    const { type: tournamentType, matches } = tournament.toState();
    const { currentRound, roundNums } = tournament.roundInfo();

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
    );
  }

  return (
    <div className="app tournament-page" data-loaded={isLoaded && isTournamentLoaded}>
      <div className="container main-container">
        <h1><span className="title-emoji">🏆 </span>Tournament</h1>
        {content}
      </div>
    </div>
  );
}

export default TournamentPage;
