import React, { useEffect, useRef, useState } from 'react';

import './App.css';
import ManualPlayerEntry from './components/players/ManualPlayerEntry';
import PlayerList from './components/players/PlayerList';
import ShareModal from './components/modals/ShareModal';
import ImportStateModal from './components/modals/ImportStateModal';
import { CourtAssignments } from './components/court';
import { useShareState } from './hooks/useShareState';
import Leaderboard from './components/players/Leaderboard';
import { engine, getEngineType } from './engines/engineSelector';
import { createPlayersFromNames } from './utils/playerUtils';
import { storageManager } from './utils/StorageManager';
import { useAppState } from './hooks/usePlayers';
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
    handleRemovePlayer,
    handleUpdatePlayer,
    handleAddPlayers,
    handleToggleSmartEngine,
    isSmartEngineEnabled,
    resetEngineHistory,
    clearAll: contextClearAll,
    applyCourtResults,
  } = useAppState();

  const [isLocalLoaded, setIsLocalLoaded] = useState(false);
  const [numberOfCourts, setNumberOfCourts] = useState<number>(4);
  const [assignments, setAssignments] = useState<Court[]>([]);
  const [isManagePlayersCollapsed, setIsManagePlayersCollapsed] = useState<boolean>(false);
  const [manualCourtSelection, setManualCourtSelection] = useState<ManualCourtSelection | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<number | undefined>();
  const [forceBenchPlayerIds, setForceBenchPlayerIds] = useState<Set<string>>(new Set());

  const { shareUrl, setShareUrl, importState, handleShare, handleImportAccept, handleImportDecline } = useShareState();

  const hasLoadedRef = useRef(false);
  const managePlayersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const loadedState = await storageManager.loadApp();
      if (loadedState.players?.length) setIsManagePlayersCollapsed(true);
      if (loadedState.numberOfCourts !== undefined) setNumberOfCourts(loadedState.numberOfCourts);
      if (loadedState.assignments?.length) setAssignments(loadedState.assignments);
      if (loadedState.lastGeneratedAt !== undefined) setLastGeneratedAt(loadedState.lastGeneratedAt);
      hasLoadedRef.current = true;
      setIsLocalLoaded(true);
    };
    load();
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    storageManager.saveApp({ numberOfCourts, assignments, lastGeneratedAt });
    engine().saveState(getEngineType());
  }, [numberOfCourts, assignments, lastGeneratedAt]);

  const handlePlayersAdded = (newNames: string[]) => {
    const newPlayers = createPlayersFromNames(newNames, 'manual');
    handleAddPlayers(newPlayers);
  };

  const handleClearAllPlayers = () => {
    contextClearAll();
    setAssignments([]);
    setLastGeneratedAt(undefined);
    setIsManagePlayersCollapsed(false);
    setManualCourtSelection(null);
  };

  const handleResetAlgorithm = () => {
    resetEngineHistory();
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
    const assignmentsWithWinners = assignments.filter(c => c.winner);
    const nextPlayers = assignmentsWithWinners.length > 0
      ? applyCourtResults(assignmentsWithWinners)
      : players;
    if (assignmentsWithWinners.length === 0) {
      engine().recordLevelSnapshot(players);
    }

    setLastGeneratedAt(Date.now());
    engine().clearCurrentSession();
    const hadManualSelection = manualCourtSelection !== null && manualCourtSelection.players.length > 0;
    const courts = engine().generate(
      nextPlayers,
      numberOfCourts,
      manualCourtSelection || undefined,
      forceBenchPlayerIds,
    );

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
      engine().updateWinner({ courtNumber, winner, currentAssignments: prevAssignments }),
    );
  };

  const handleRotateTeams = (courtNumber: number) => {
    setAssignments(prevAssignments => {
      const court = prevAssignments.find(c => c.courtNumber === courtNumber);
      if (!court?.teams) return prevAssignments;

      return engine().updateWinner({ courtNumber, winner: undefined, currentAssignments: prevAssignments, rotatedCourt: rotateCourtTeams(court) });
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
    <div className={`app${isSmartEngineEnabled ? ' night-theme' : ''}`} data-loaded={isLoaded && isLocalLoaded}>
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
              <ManualPlayerEntry onPlayersAdded={handlePlayersAdded} />

              {hasPlayers && (
                <PlayerList
                  players={players}
                  onPlayerToggle={handlePlayerToggle}
                  onRemovePlayer={handleRemovePlayer}
                  onClearAllPlayers={handleClearAllPlayers}
                  onResetAlgorithm={handleResetAlgorithm}
                  benchCounts={engine().getBenchCounts()}
                  forceBenchPlayerIds={forceBenchPlayerIds}
                  onToggleForceBench={handleToggleForceBench}
                  onToggleSmartEngine={handleToggleSmartEngine}
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
              benchedPlayers={engine().getBenchedPlayers(assignments, players)}
              numberOfCourts={numberOfCourts}
              onNumberOfCourtsChange={setNumberOfCourts}
              onGenerateAssignments={generateAssignments}
              onWinnerChange={handleWinnerChange}
              onScoreChange={handleScoreChange}
              hasHistoricalWinners={engine().getWinCounts().size > 0}
              onRotateTeams={handleRotateTeams}
              hasManualCourtSelection={assignments.some(court => (court as any).wasManuallyAssigned)}
              onViewBenchCounts={handleViewBenchCounts}
              manualCourtSelection={manualCourtSelection}
              onManualCourtSelectionChange={setManualCourtSelection}
              lastGeneratedAt={lastGeneratedAt}
            />
          </div>
        </div>

        <Leaderboard
          players={players}
          winCounts={engine().getWinCounts()}
          lossCounts={engine().getStats().lossCountMap}
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
          <a
            href={`${import.meta.env.BASE_URL || '/'}stats`}
            className="analysis-link"
            data-testid="stats-link"
          >
            View Statistics & Analysis
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
