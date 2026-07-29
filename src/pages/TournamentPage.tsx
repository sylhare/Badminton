import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAppState } from '../providers/AppStateProvider';
import { Tournament } from '../components/tournament/Tournament';
import Footer from '../components/Footer';
import { RoundRobinTournament } from '../tournament/RoundRobinTournament';
import { EliminationTournament } from '../tournament/EliminationTournament';
import { tournamentLevelInputs } from '../tournament/tournamentLevels';
import type { TournamentFormat, TournamentTeam, TournamentType } from '../tournament/types';
import './TournamentPage.css';

const TournamentPage = (): React.ReactElement => {
  const {
    players, isLoaded, handleAddPlayers, handlePlayerToggle, isSmartEngineEnabled,
    applyLevelReplay, numberOfCourts, tournament, setTournament,
  } = useAppState();
  const [showSetup, setShowSetup] = useState(false);

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
    if (!tournament) return;
    const next = tournament.withMatchResult(matchId, winner, score);
    setTournament(next);
    const { baseline, courts } = tournamentLevelInputs(next);
    applyLevelReplay(baseline, courts);
  };

  const handleReset = () => {
    setTournament(null);
    setShowSetup(false);
  };

  const goToView = (setup: boolean) => {
    setShowSetup(setup);
    window.scrollTo(0, 0);
  };

  const hasTournament = tournament !== null && tournament.phase() !== 'setup';
  const isSetupView = !hasTournament || showSetup;

  return (
    <div className={`app tournament-page${isSmartEngineEnabled ? ' smart-mode' : ''}`} data-loaded={isLoaded}>
      <nav className="tournament-banner" data-testid="tournament-banner">
        <Link to="/" className="banner-nav-link" data-testid="back-to-app">
          ← Court Manager
        </Link>
        <button
          className="banner-nav-link"
          onClick={() => goToView(true)}
          disabled={isSetupView}
          data-testid="back-to-setup"
        >
          Tournament Setup
        </button>
        <button
          className="banner-nav-link"
          onClick={() => goToView(false)}
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
          initialNumberOfCourts={numberOfCourts}
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

