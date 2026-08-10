import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAppState } from '../providers/AppStateProvider';
import type { AnyTournament } from '../providers/AppStateProvider';
import { Tournament } from '../components/tournament/Tournament';
import type { Tournament as TournamentBase } from '../tournament/Tournament';
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

  /** Commit the outgoing tournament's ELO before it is replaced or discarded, if still in progress. */
  const flushIfActive = () => {
    if (tournament && !tournament.isComplete()) commitElo(tournament);
  };

  const handleStart = (
    teams: TournamentTeam[],
    numberOfCourts: number,
    format: TournamentFormat,
    type: TournamentType,
    bestOf: number,
    groupSize?: number,
    qualifiersPerGroup?: number,
    setSize?: number,
  ) => {
    flushIfActive();
    const created = TOURNAMENT_FACTORY[type].create({
      format, numberOfCourts, bestOf, setSize, groupSize, qualifiersPerGroup,
    });
    setTournament(created.start(teams, numberOfCourts));
    setShowSetup(false);
  };

  /** Commit the tournament as it moves from active to complete (records ELO once). */
  const commitTournament = (next: AnyTournament) => {
    setTournament(next);
    if (tournament && !tournament.isComplete() && next.isComplete()) commitElo(next);
  };

  const handleMatchResult = (
    matchId: string,
    winner: 1 | 2,
    sets?: SetScore[],
  ) => {
    if (!tournament) return;
    commitTournament(tournament.withMatchResult(matchId, winner, sets));
  };

  /** Replace the tournament wholesale (e.g. a manual tie-break re-order). */
  const handleUpdateTournament = (next: TournamentBase) => {
    commitTournament(next as AnyTournament);
  };

  const handleReset = () => {
    flushIfActive();
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
          onUpdateTournament={handleUpdateTournament}
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

