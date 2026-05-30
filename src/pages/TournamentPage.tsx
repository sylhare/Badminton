import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { storageManager } from '../utils/StorageManager';
import { useAppState } from '../providers/AppStateProvider';
import { Tournament } from '../components/tournament/Tournament';
import Footer from '../components/Footer';
import { RoundRobinTournament } from '../tournament/RoundRobinTournament';
import { EliminationTournament } from '../tournament/EliminationTournament';
import type { TournamentFormat, TournamentTeam, TournamentType } from '../tournament/types';
import './TournamentPage.css';

type AnyTournament = RoundRobinTournament | EliminationTournament;

const TournamentPage = (): React.ReactElement => {
  const { players, isLoaded, handleAddPlayers, handlePlayerToggle } = useAppState();
  const [initialNumberOfCourts, setInitialNumberOfCourts] = useState(4);
  const [tournament, setTournament] = useState<AnyTournament | null>(null);
  const [isTournamentLoaded, setIsTournamentLoaded] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    Promise.all([storageManager.loadApp(), storageManager.loadTournament()]).then(
      ([appState, savedTournament]) => {
        if (appState.numberOfCourts !== undefined) setInitialNumberOfCourts(appState.numberOfCourts);
        if (savedTournament) {
          if (savedTournament.type === 'elimination') {
            setTournament(EliminationTournament.fromState(savedTournament));
          } else {
            setTournament(RoundRobinTournament.fromState(savedTournament));
          }
        }
        setIsTournamentLoaded(true);
      },
    );
  }, []);

  useEffect(() => {
    if (!isTournamentLoaded) return;
    storageManager.saveTournament(tournament?.state() ?? null);
  }, [tournament, isTournamentLoaded]);

  const handleStart = (
    teams: TournamentTeam[],
    numberOfCourts: number,
    format: TournamentFormat,
    type: TournamentType,
  ) => {
    if (type === 'elimination') {
      setTournament(EliminationTournament.create(format, numberOfCourts).start(teams, numberOfCourts));
    } else {
      setTournament(RoundRobinTournament.create(format, numberOfCourts).start(teams, numberOfCourts));
    }
    setShowSetup(false);
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
    setShowSetup(false);
  };

  const hasTournament = tournament !== null && tournament.phase() !== 'setup';
  const isSetupView = !hasTournament || showSetup;

  return (
    <div className="app tournament-page" data-loaded={isLoaded}>
      <nav className="tournament-banner" data-testid="tournament-banner">
        <Link to="/" className="banner-nav-link" data-testid="back-to-app">
          ← Court Manager
        </Link>
        <button
          className="banner-nav-link"
          onClick={() => setShowSetup(true)}
          disabled={isSetupView}
          data-testid="back-to-setup"
        >
          Tournament Setup
        </button>
        <button
          className="banner-nav-link"
          onClick={() => setShowSetup(false)}
          disabled={!hasTournament || !isSetupView}
          data-testid="back-to-tournament"
        >
          Current Tournament
        </button>
      </nav>
      <div className="container main-container">
        <h1>
          <span className="title-emoji">{isSetupView ? '⚙️ ' : '🏆 '}</span>
          {isSetupView ? 'Tournament Setup' : 'Tournament'}
        </h1>
        <Tournament
          tournament={tournament}
          initialPlayers={players}
          initialNumberOfCourts={initialNumberOfCourts}
          onStart={handleStart}
          onMatchResult={handleMatchResult}
          onReset={handleReset}
          onAddPlayers={handleAddPlayers}
          onTogglePlayer={handlePlayerToggle}
          showSetup={showSetup}
        />
      </div>
      <Footer />
    </div>
  );
};

export default TournamentPage;

