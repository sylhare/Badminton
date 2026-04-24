import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import './App.css';
import ManualPlayerEntry from './components/players/ManualPlayerEntry';
import PlayerList from './components/players/PlayerList';
import ShareModal from './components/modals/ShareModal';
import ImportStateModal from './components/modals/ImportStateModal';
import { CourtAssignments } from './components/court';
import { useShareState } from './hooks/useShareState';
import Leaderboard from './components/players/Leaderboard';
import { storageManager } from './utils/StorageManager';
import { useAppState } from './providers/AppStateProvider';
import { benchedPlayers } from './utils/playerUtils';
import type { Court, ManualCourtSelection, WinnerSelection } from './types';

export function rotateCourtTeams(court: Court): Court {
  const { teams, players } = court;
  if (!teams) return court;

  if (players.length === 4) {
    const [p0, p1, p2, p3] = players;
    const team1Ids = new Set(teams.team1.map(p => p.id));

    if (team1Ids.has(p0.id) && team1Ids.has(p1.id)) {
      return { ...court, teams: { team1: [p0, p2], team2: [p1, p3] }, winner: undefined };
    } else if (team1Ids.has(p0.id) && team1Ids.has(p2.id)) {
      return { ...court, teams: { team1: [p0, p3], team2: [p1, p2] }, winner: undefined };
    } else {
      return { ...court, teams: { team1: [p0, p1], team2: [p2, p3] }, winner: undefined };
    }
  }

  return { ...court, teams: { team1: teams.team2, team2: teams.team1 }, winner: undefined };
}

function App(): React.ReactElement {
  const {
    players,
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
    generateCourts,
    updateWinner,
    saveState,
    resetAlgorithm,
  } = useAppState();

  const [numberOfCourts, setNumberOfCourts] = useState<number>(4);
  const [assignments, setAssignments] = useState<Court[]>([]);
  const [isManagePlayersCollapsed, setIsManagePlayersCollapsed] = useState<boolean>(false);
  const [manualCourtSelection, setManualCourtSelection] = useState<ManualCourtSelection | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<number | undefined>();
  const [forceBenchPlayerIds, setForceBenchPlayerIds] = useState<Set<string>>(new Set());

  const { shareUrl, setShareUrl, importState, handleShare, handleImportAccept, handleImportDecline } = useShareState();

  const hasLocalLoadedRef = useRef(false);
  const managePlayersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const loadedState = await storageManager.loadApp();
      if (loadedState.players?.length) {
        setIsManagePlayersCollapsed(true);
      }
      if (loadedState.numberOfCourts !== undefined) setNumberOfCourts(loadedState.numberOfCourts);
      if (loadedState.assignments?.length) setAssignments(loadedState.assignments);
      if (loadedState.lastGeneratedAt !== undefined) setLastGeneratedAt(loadedState.lastGeneratedAt);
      hasLocalLoadedRef.current = true;
    };
    load();
  }, []);

  useEffect(() => {
    if (!hasLocalLoadedRef.current) return;
    storageManager.saveApp({ numberOfCourts, assignments, lastGeneratedAt });
    void saveState();
  }, [numberOfCourts, assignments, lastGeneratedAt]);

  const handleClearAllPlayers = () => {
    clearPlayers();
    setAssignments([]);
    setLastGeneratedAt(undefined);
    setIsManagePlayersCollapsed(false);
    setManualCourtSelection(null);
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
    const hadManualSelection = manualCourtSelection !== null && manualCourtSelection.players.length > 0;
    const courts = generateCourts(players, numberOfCourts, assignments, manualCourtSelection, forceBenchPlayerIds);

    if (hadManualSelection) {
      courts.forEach(court => {
        if (court.courtNumber === 1) {
          court.wasManuallyAssigned = true;
        }
      });
    }

    setAssignments(courts);
    if (!isManagePlayersCollapsed) {
      setIsManagePlayersCollapsed(true);
    }
    setManualCourtSelection(null);
    setForceBenchPlayerIds(new Set());
  };

  const handleWinnerChange = (courtNumber: number, winner: WinnerSelection) => {
    setAssignments(prevAssignments =>
      updateWinner({ courtNumber, winner, currentAssignments: prevAssignments }),
    );
  };

  const handleRotateTeams = (courtNumber: number) => {
    setAssignments(prevAssignments => {
      const court = prevAssignments.find(c => c.courtNumber === courtNumber);
      if (!court?.teams) return prevAssignments;

      return updateWinner({ courtNumber, winner: undefined, currentAssignments: prevAssignments, rotatedCourt: rotateCourtTeams(court) });
    });
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
    const timerId = setTimeout(() => {
      managePlayersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => clearTimeout(timerId);
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
    <div className={`app${isSmartEngineEnabled ? ' night-theme' : ''}`} data-loaded={isLoaded}>
      <div className="container main-container">
        <h1><span className="title-emoji">🏸 </span>Badminton Court Manager</h1>

        {/* Manage Players Section - Collapsible */}
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

        {/* Court Assignments Section - Never collapsed */}
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
              hasManualCourtSelection={assignments.some(court => (court as any).wasManuallyAssigned)}
              onViewBenchCounts={handleViewBenchCounts}
              manualCourtSelection={manualCourtSelection}
              onManualCourtSelectionChange={setManualCourtSelection}
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

      <footer className="app-footer">
        <p>
          Have feedback? Found a bug or want to suggest a feature?
          {' '}
          <a
            href="https://github.com/sylhare/Badminton/issues/new/choose"
            target="_blank"
            rel="noopener noreferrer"
          >
            Let us know on GitHub
          </a>
        </p>
        <p>
          <Link
            to="/stats"
            className="analysis-link"
            data-testid="stats-link"
          >
            View Statistics & Analysis
          </Link>
        </p>
      </footer>
    </div>
  );
}

export default App;
