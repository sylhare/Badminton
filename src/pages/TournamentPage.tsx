import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAppState } from '../providers/AppStateProvider';
import type { AnyTournament } from '../providers/AppStateProvider';
import { Tournament } from '../components/tournament/Tournament';
import Footer from '../components/Footer';
import { TOURNAMENT_FACTORY } from '../tournament/tournamentFactory';
import { tournamentToScoredGames } from '../engines/levelAdapters';
import type { SetScore, TournamentFormat, TournamentTeam, TournamentType } from '../tournament/types';
import './TournamentPage.css';

const TournamentPage = (): React.ReactElement => {
  const {
    players, isLoaded, handleAddPlayers, handlePlayerToggle, isSmartEngineEnabled,
    applyGameResults, numberOfCourts, tournament, setTournament,
  } = useAppState();
  const [showSetup, setShowSetup] = useState(false);

  const commitElo = (t: AnyTournament) => {
    const { baseline, games } = tournamentToScoredGames(t);
    if (games.length) applyGameResults(games, baseline);
  };

  const handleStart = (
    teams: TournamentTeam[],
    numberOfCourts: number,
    format: TournamentFormat,
    type: TournamentType,
    bestOf: number,
    groupSize?: number,
    qualifiersPerGroup?: number,
  ) => {
    if (tournament && !tournament.isComplete()) commitElo(tournament);
    const created = TOURNAMENT_FACTORY[type].create({ format, numberOfCourts, bestOf, groupSize, qualifiersPerGroup });
    setTournament(created.start(teams, numberOfCourts));
    setShowSetup(false);
  };

  const handleMatchResult = (
    matchId: string,
    winner: 1 | 2,
    sets?: SetScore[],
  ) => {
    if (!tournament) return;
    const next = tournament.withMatchResult(matchId, winner, sets);
    setTournament(next);
    if (!tournament.isComplete() && next.isComplete()) commitElo(next);
  };

  const handleReset = () => {
    if (tournament && !tournament.isComplete()) commitElo(tournament);
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

