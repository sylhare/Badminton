import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { engine, getEngineType, setEngine } from '../engines/engineSelector';
import { levelTracker } from '../engines/LevelTracker';
import type { AppStateContextType, CourtEngineState, Court, GenerateResult, ManualCourtSelection, Player, UpdateWinnerParams } from '../types';
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
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSmartEngineEnabled, setIsSmartEngineEnabled] = useState(false);
  const [counts, setCounts] = useState({ wins: new Map<string, number>(), losses: new Map<string, number>(), bench: new Map<string, number>() });
  const [engineState, setEngineState] = useState<CourtEngineState | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      const loadedState = await storageManager.loadApp();
      if (loadedState.players?.length) {
        setPlayers(loadedState.players);
      }
      const smart = loadedState.isSmartEngineEnabled ?? false;
      if (smart) setIsSmartEngineEnabled(true);
      const engineType = smart ? 'sl' : 'sa';
      setEngine(engineType);
      await engine().loadState(engineType);
      const { winCountMap, lossCountMap, benchCountMap } = engine().stats();
      setCounts({ wins: winCountMap, losses: lossCountMap, bench: benchCountMap });
      setEngineState(engine().prepareStateForSaving(engineType));
      hasLoadedRef.current = true;
      setIsLoaded(true);
    };
    load();

    return engine().onStateChange(() => {
      const { winCountMap, lossCountMap, benchCountMap } = engine().stats();
      setCounts({ wins: winCountMap, losses: lossCountMap, bench: benchCountMap });
      setEngineState(engine().prepareStateForSaving(getEngineType()));
    });
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    storageManager.saveApp({ players, isSmartEngineEnabled });
  }, [players, isSmartEngineEnabled]);

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
    const next = !isSmartEngineEnabled;
    setIsSmartEngineEnabled(next);
    setEngine(next ? 'sl' : 'sa');
  };

  const applyCourtResults = useCallback((courts: Court[]) => {
    const courtsWithWinners = courts.filter(c => c.winner);
    if (courtsWithWinners.length > 0) {
      const nextPlayers = levelTracker.updatePlayersLevels(courtsWithWinners, players);
      engine().recordLevelSnapshot(nextPlayers);
      setPlayers(nextPlayers);
    } else {
      engine().recordLevelSnapshot(players);
    }
  }, [players]);

  const generate = useCallback((
    players: Player[],
    numberOfCourts: number,
    previousAssignments: Court[],
    manualCourtSelection?: ManualCourtSelection | null,
    forceBenchPlayerIds?: Set<string>,
  ): GenerateResult => {
    const courts = engine().generate(players, numberOfCourts, manualCourtSelection || undefined, forceBenchPlayerIds);
    if (courts.committed) applyCourtResults(previousAssignments);
    return courts;
  }, [applyCourtResults]);

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
