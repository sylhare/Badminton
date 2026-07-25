import React, { useEffect, useRef, useState } from 'react';

import './App.css';
import ManualPlayerEntry from './components/players/ManualPlayerEntry';
import PlayerList from './components/players/PlayerList';
import ShareModal from './components/modals/ShareModal';
import ImportStateModal from './components/modals/ImportStateModal';
import { CourtAssignments } from './components/court';
import { useShareState } from './hooks/useShareState';
import Leaderboard from './components/players/Leaderboard';
import Footer from './components/Footer';
import { useAppState } from './providers/AppStateProvider';
import { benchedPlayers } from './utils/playerUtils';
import { applyCourtSwap } from './utils/courtSwap';
import type { SlotAddr } from './utils/slotSwap';
import type { Court, WinnerSelection } from './types';

export function rotateCourtTeams(court: Court): Court {
  const { teams, players } = court;
  if (!teams) return court;

  const cleared = { ...court, winner: undefined, score: undefined };

  if (players.length === 4) {
    const [p0, p1, p2, p3] = players;
    const team1Ids = new Set(teams.team1.map(p => p.id));

    if (team1Ids.has(p0.id) && team1Ids.has(p1.id)) {
      return { ...cleared, teams: { team1: [p0, p2], team2: [p1, p3] } };
    } else if (team1Ids.has(p0.id) && team1Ids.has(p2.id)) {
      return { ...cleared, teams: { team1: [p0, p3], team2: [p1, p2] } };
    } else {
      return { ...cleared, teams: { team1: [p0, p1], team2: [p2, p3] } };
    }
  }

  return { ...cleared, teams: { team1: teams.team2, team2: teams.team1 } };
}

function App(): React.ReactElement {
  const {
    players,
    numberOfCourts,
    setNumberOfCourts,
    assignments,
    setAssignments,
    lastGeneratedAt,
    setLastGeneratedAt,
    isLoaded,
    handlePlayerToggle,
    handleAddPlayers,
    handleRemovePlayer,
    handleUpdatePlayer,
    clearPlayers,
    isSmartEngineEnabled,
    handleToggleSmartEngine,
    winCounts,
    lossCounts,
    benchCounts,
    generate,
    updateWinner,
    applyManualEdit,
    resetAlgorithm,
  } = useAppState();

  const [isManagePlayersCollapsed, setIsManagePlayersCollapsed] = useState<boolean>(false);
  const [forceBenchPlayerIds, setForceBenchPlayerIds] = useState<Set<string>>(new Set());

  const { shareUrl, setShareUrl, importState, handleShare, handleImportAccept, handleImportDecline } = useShareState();

  const hasInitialisedCollapseRef = useRef(false);
  const managePlayersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoaded || hasInitialisedCollapseRef.current) return;
    hasInitialisedCollapseRef.current = true;
    if (players.length > 0) setIsManagePlayersCollapsed(true);
  }, [isLoaded, players]);

  const handleClearAllPlayers = () => {
    clearPlayers();
    setAssignments([]);
    setLastGeneratedAt(undefined);
    setIsManagePlayersCollapsed(false);
  };

  const handleResetAlgorithm = async () => {
    await resetAlgorithm();
    setAssignments([]);
    setLastGeneratedAt(undefined);
  };

  const handleScoreChange = (courtNumber: number, score?: { team1: number; team2: number }) => {
    setAssignments(prev =>
      prev.map(c =>
        c.courtNumber === courtNumber ? { ...c, score } : c,
      ),
    );
  };

  const generateAssignments = () => {
    setLastGeneratedAt(Date.now());
    const result = generate(players, numberOfCourts, assignments, forceBenchPlayerIds);

    setAssignments(result.courts);
    if (!isManagePlayersCollapsed) {
      setIsManagePlayersCollapsed(true);
    }
    setForceBenchPlayerIds(new Set());
  };

  const handleWinnerChange = (courtNumber: number, winner: WinnerSelection) => {
    setAssignments(updateWinner({ courtNumber, winner, currentAssignments: assignments }));
  };

  const handleRotateTeams = (courtNumber: number) => {
    const court = assignments.find(c => c.courtNumber === courtNumber);
    if (!court?.teams) return;

    setAssignments(updateWinner({ courtNumber, winner: undefined, currentAssignments: assignments, rotatedCourt: rotateCourtTeams(court) }));
  };

  const handleSwapPlayers = (from: SlotAddr, to: SlotAddr) => {
    const bench = benchedPlayers(assignments, players);
    const { courts: next } = applyCourtSwap(assignments, bench, from, to);
    if (next === assignments) return;
    setAssignments(applyManualEdit(assignments, next));
  };

  const handleToggleForceBench = (playerId: string) => {
    setForceBenchPlayerIds(prev => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  const handleViewBenchCounts = () => {
    setIsManagePlayersCollapsed(false);
    setTimeout(() => {
      managePlayersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const toggleManagePlayers = (event?: React.MouseEvent) => {
    if (event) {
      const target = event.target as HTMLElement;
      const isHeaderClick = target.closest('.section-header') !== null;
      if (!isHeaderClick) return;
    }
    setIsManagePlayersCollapsed(prev => !prev);
  };

  const hasPlayers = players.length > 0;

  return (
    <div className={`app${isSmartEngineEnabled ? ' smart-mode' : ''}`} data-loaded={isLoaded}>
      <div className="container main-container">
        <h1><span className="title-emoji">🏸 </span>Badminton Court Manager</h1>

        <div
          ref={managePlayersRef}
          className={`section ${isManagePlayersCollapsed ? 'collapsed' : ''}`}
          data-testid="manage-players-section"
        >
          <div
            className="section-header"
            onClick={toggleManagePlayers}
          >
            <h2>Manage Players</h2>
            <span className="collapse-indicator">{isManagePlayersCollapsed ? '▶' : '▼'}</span>
          </div>

          {!isManagePlayersCollapsed && (
            <div className="section-content">
              <ManualPlayerEntry onPlayersAdded={handleAddPlayers} />

              {hasPlayers && (
                <PlayerList
                  players={players}
                  onPlayerToggle={handlePlayerToggle}
                  onRemovePlayer={handleRemovePlayer}
                  onClearAllPlayers={handleClearAllPlayers}
                  onResetAlgorithm={handleResetAlgorithm}
                  benchCounts={benchCounts}
                  forceBenchPlayerIds={forceBenchPlayerIds}
                  onToggleForceBench={handleToggleForceBench}
                  onToggleSmartEngine={handleToggleSmartEngine}
                  isSmartEngineEnabled={isSmartEngineEnabled}
                  onUpdatePlayer={handleUpdatePlayer}
                  onShare={handleShare}
                />
              )}
            </div>
          )}
        </div>

        <div className="section" data-testid="court-assignments-section">
          <div className="section-header no-collapse">
            <h2>Court Assignments</h2>
          </div>

          <div className="section-content">
            <CourtAssignments
              players={players}
              assignments={assignments}
              benchedPlayers={benchedPlayers(assignments, players)}
              numberOfCourts={numberOfCourts}
              onNumberOfCourtsChange={setNumberOfCourts}
              onGenerateAssignments={generateAssignments}
              onWinnerChange={handleWinnerChange}
              onScoreChange={handleScoreChange}
              hasHistoricalWinners={winCounts.size > 0}
              onRotateTeams={handleRotateTeams}
              onSwapPlayers={handleSwapPlayers}
              onViewBenchCounts={handleViewBenchCounts}
              lastGeneratedAt={lastGeneratedAt}
              isSmartEngineEnabled={isSmartEngineEnabled}
            />
          </div>
        </div>

        <Leaderboard
          players={players}
          winCounts={winCounts}
          lossCounts={lossCounts}
        />
      </div>

      <ShareModal
        isOpen={shareUrl !== null}
        shareUrl={shareUrl ?? ''}
        onClose={() => setShareUrl(null)}
      />

      <ImportStateModal
        isOpen={importState !== null}
        currentBackupUrl={importState?.backupUrl ?? ''}
        sharedSavedAt={importState?.sharedSavedAt}
        currentSavedAt={importState?.currentSavedAt}
        onAccept={handleImportAccept}
        onDecline={handleImportDecline}
      />

      <Footer showTournamentLink={winCounts.size > 0 || isSmartEngineEnabled} />
    </div>
  );
}

export default App;
