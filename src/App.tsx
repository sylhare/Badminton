import React, { useEffect, useRef, useState } from 'react';

import './App.css';
import ManualPlayerEntry from './components/ManualPlayerEntry';
import PlayerList from './components/PlayerList';
import { CourtAssignments } from './components/court';
import Leaderboard from './components/Leaderboard';
import { engine, getEngineType, setEngine } from './engines/engineSelector';
import { createPlayersFromNames } from './utils/playerUtils';
import { clearAllStoredState, loadAppState, saveAppState } from './utils/storageUtils';
import { levelTracker } from './engines/LevelTracker';
import type { Court, ManualCourtSelection, Player, WinnerSelection } from './types';

function App(): React.ReactElement {
  const loadedState = loadAppState();
  const [players, setPlayers] = useState<Player[]>(loadedState.players ?? []);
  const [numberOfCourts, setNumberOfCourts] = useState<number>(loadedState.numberOfCourts ?? 4);
  const [assignments, setAssignments] = useState<Court[]>(loadedState.assignments ?? []);
  const [isManagePlayersCollapsed, setIsManagePlayersCollapsed] = useState<boolean>(
    (loadedState.players ?? []).length > 0,
  );
  const [manualCourtSelection, setManualCourtSelection] = useState<ManualCourtSelection | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<number | undefined>(loadedState.lastGeneratedAt);
  const [_engineStateVersion, setEngineStateVersion] = useState<number>(0);
  const [forceBenchPlayerIds, setForceBenchPlayerIds] = useState<Set<string>>(new Set());
  const [isSmartEngineEnabled, setIsSmartEngineEnabled] = useState<boolean>(
    loadedState.isSmartEngineEnabled ?? false,
  );

  const isInitialLoad = useRef(true);
  const managePlayersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const engineType = isSmartEngineEnabled ? 'sl' : 'sa';
    setEngine(engineType);
    engine().loadState(engineType);
    setEngineStateVersion(prev => prev + 1);
    isInitialLoad.current = false;

    return engine().onStateChange(() => {
      setEngineStateVersion(prev => prev + 1);
    });
  }, []);

  useEffect(() => {
    if (isInitialLoad.current) return;

    saveAppState({
      players,
      numberOfCourts,
      assignments,
      lastGeneratedAt,
      isSmartEngineEnabled,
    });
    engine().saveState(getEngineType());
  }, [players, numberOfCourts, assignments, lastGeneratedAt, isSmartEngineEnabled]);

  const handlePlayersAdded = (newNames: string[]) => {
    const newPlayers = createPlayersFromNames(newNames, 'manual');
    setPlayers(prev => [...prev, ...newPlayers]);
  };

  const handlePlayerToggle = (playerId: string) => {
    setPlayers(prev =>
      prev.map(player =>
        player.id === playerId
          ? { ...player, isPresent: !player.isPresent }
          : player,
      ),
    );
  };

  const handleRemovePlayer = (playerId: string) => {
    engine().removePlayerHistory(playerId);
    setPlayers(prev => prev.filter(player => player.id !== playerId));
  };

  const recordCurrentWins = () => {
    if (assignments.length > 0) {
      const assignmentsWithWinners = assignments.filter(court => court.winner);
      if (assignmentsWithWinners.length > 0) {
        engine().recordWins(assignmentsWithWinners);
      }
    }
  };

  const handleClearAllPlayers = () => {
    setPlayers([]);
    setAssignments([]);
    setLastGeneratedAt(undefined);
    setIsManagePlayersCollapsed(false);
    setManualCourtSelection(null);
    engine().resetHistory();
    setTimeout(() => clearAllStoredState(), 0);
  };

  const handleResetAlgorithm = () => {
    engine().resetHistory();
    engine().saveState(getEngineType());
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
    recordCurrentWins();

    const assignmentsWithWinners = assignments.filter(c => c.winner);
    const nextPlayers = assignmentsWithWinners.length > 0
      ? levelTracker.updatePlayersLevels(assignmentsWithWinners, players)
      : players;
    if (assignmentsWithWinners.length > 0) {
      setPlayers(nextPlayers);
    }
    engine().recordLevelSnapshot(nextPlayers);

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
      engine().updateWinner(courtNumber, winner, prevAssignments),
    );
  };

  const handleToggleSmartEngine = () => {
    const next = !isSmartEngineEnabled;
    setIsSmartEngineEnabled(next);
    setEngine(next ? 'sl' : 'sa');
  };

  const handleUpdatePlayer = (id: string, gender: Player['gender'], level: number) => {
    setPlayers(prev =>
      prev.map(player =>
        player.id === id ? { ...player, gender, level } : player,
      ),
    );
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
    <div className={`app${isSmartEngineEnabled ? ' night-theme' : ''}`}>
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
                  isSmartEngineEnabled={isSmartEngineEnabled}
                  onToggleSmartEngine={handleToggleSmartEngine}
                  onUpdatePlayer={handleUpdatePlayer}
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
          isSmartEngineEnabled={isSmartEngineEnabled}
        />
      </div>

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
