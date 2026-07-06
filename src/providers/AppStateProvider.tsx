import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { engine, getEngineType, setEngine } from '../engines/engineSelector';
import { levelTracker } from '../engines/LevelTracker';
import type { AppStateContextType, Court, EngineSnapshot, GenerateResult, ManualCourtSelection, Player, UpdateWinnerParams } from '../types';
import { useAnalytics } from '../hooks/useAnalytics';
import { createPlayersFromNames } from '../utils/playerUtils';
import { storageManager } from '../utils/StorageManager';

const AppStateContext = createContext<AppStateContextType | null>(null);

export function useAppState(): AppStateContextType {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}

export function AppStateProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [players, setPlayers] = useState<Player[]>([]);
  const [numberOfCourts, setNumberOfCourts] = useState<number>(4);
  const [assignments, setAssignments] = useState<Court[]>([]);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<number | undefined>();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSmartEngineEnabled, setIsSmartEngineEnabled] = useState(false);
  const [counts, setCounts] = useState({ wins: new Map<string, number>(), losses: new Map<string, number>(), bench: new Map<string, number>() });
  const [engineState, setEngineState] = useState<EngineSnapshot | null>(null);
  const hasLoadedRef = useRef(false);
  const { trackAssignmentAnomaly } = useAnalytics();

  const syncFromEngine = useCallback(() => {
    const { winCountMap, lossCountMap, benchCountMap } = engine().stats();
    setCounts({ wins: winCountMap, losses: lossCountMap, bench: benchCountMap });
    setEngineState(engine().snapshot());
  }, []);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;

    const hydrate = async () => {
      try {
        const loadedState = await storageManager.loadApp();
        if (loadedState.players?.length) setPlayers(loadedState.players);
        if (loadedState.numberOfCourts !== undefined) setNumberOfCourts(loadedState.numberOfCourts);
        if (loadedState.assignments?.length) setAssignments(loadedState.assignments);
        if (loadedState.lastGeneratedAt !== undefined) setLastGeneratedAt(loadedState.lastGeneratedAt);
        const smart = loadedState.isSmartEngineEnabled ?? false;
        if (smart) setIsSmartEngineEnabled(true);
        const engineType = smart ? 'sl' : 'sa';
        setEngine(engineType);
        await engine().loadState(engineType);
        // Re-persist after a successful load to refresh the stored savedAt, so the
        // engine's pair-history TTL (see loadState) measures time since the last
        // app open rather than the last game played.
        await engine().saveState(engineType);
      } catch (error) {
        console.warn('AppStateProvider: failed to load persisted state:', error);
      }
    };

    hydrate().then(() => {
      if (cancelled) return;
      cleanup = engine().onStateChange(() => {
        syncFromEngine();
        // Coalesce bursts of engine notifications into a single debounced write.
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          // saveState() prunes history synchronously before persisting; re-sync
          // so the rendered snapshot reflects any pruning rather than showing
          // entries that were just dropped from storage.
          void engine().saveState(getEngineType());
          syncFromEngine();
        });
      });
      hasLoadedRef.current = true;
      setIsLoaded(true);
      syncFromEngine();
    });

    return () => {
      cancelled = true;
      clearTimeout(saveTimer);
      cleanup?.();
    };
  }, [syncFromEngine]);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    storageManager.saveApp({ players, isSmartEngineEnabled, numberOfCourts, assignments, lastGeneratedAt });
  }, [players, isSmartEngineEnabled, numberOfCourts, assignments, lastGeneratedAt]);

  const handleAddPlayers = (names: string[]) => {
    const newPlayers = createPlayersFromNames(names, 'manual');
    setPlayers(prev => [...prev, ...newPlayers]);
  };

  const handlePlayerToggle = (id: string) => {
    setPlayers(prev =>
      prev.map(p => p.id === id ? { ...p, isPresent: !p.isPresent } : p),
    );
  };

  const handleRemovePlayer = (id: string) => {
    engine().removePlayerHistory(id);
    setPlayers(prev => prev.filter(p => p.id !== id));
  };

  const handleUpdatePlayer = (id: string, gender: Player['gender'], level: number) => {
    setPlayers(prev =>
      prev.map(p => p.id === id ? { ...p, gender, level } : p),
    );
  };

  const clearPlayers = () => {
    setPlayers([]);
    engine().resetHistory();
    storageManager.clearAll();
  };

  const handleToggleSmartEngine = () => {
    if (!isLoaded) return;
    const next = !isSmartEngineEnabled;
    setIsSmartEngineEnabled(next);
    setEngine(next ? 'sl' : 'sa');
    syncFromEngine();
  };

  const applyCourtResults = useCallback((courts: Court[]) => {
    const courtsWithWinners = courts.filter(c => c.winner);
    if (courtsWithWinners.length > 0) {
      const nextPlayers = levelTracker.updatePlayersLevels(courtsWithWinners, players);
      engine().recordLevelSnapshot(nextPlayers.filter(p => p.isPresent));
      setPlayers(nextPlayers);
    } else {
      engine().recordLevelSnapshot(players.filter(p => p.isPresent));
    }
  }, [players]);

  const generate = useCallback((
    players: Player[],
    numberOfCourts: number,
    previousAssignments: Court[],
    manualCourtSelection?: ManualCourtSelection | null,
    forceBenchPlayerIds?: Set<string>,
  ): GenerateResult => {
    const result = engine().generate(players, numberOfCourts, manualCourtSelection || undefined, forceBenchPlayerIds);
    if (result.committed) applyCourtResults(previousAssignments);

    result.anomalies.forEach(trackAssignmentAnomaly);

    return result;
  }, [applyCourtResults, trackAssignmentAnomaly]);

  const updateWinner = useCallback((params: UpdateWinnerParams): Court[] => {
    return engine().updateWinner(params);
  }, []);

  const saveState = useCallback(async (): Promise<void> => {
    await engine().saveState(getEngineType());
  }, []);

  const resetAlgorithm = useCallback(async (): Promise<void> => {
    engine().resetHistory();
    await engine().saveState(getEngineType());
  }, []);

  const levelTrend = useCallback((playerId: string) => engine().levelTrend(playerId), []);

  const value: AppStateContextType = {
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
    setPlayers,
    isSmartEngineEnabled,
    handleToggleSmartEngine,
    winCounts: counts.wins,
    lossCounts: counts.losses,
    benchCounts: counts.bench,
    engineState,
    levelTrend,
    generate,
    updateWinner,
    saveState,
    resetAlgorithm,
    engineName: engine().name,
    engineDescription: engine().description,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}
