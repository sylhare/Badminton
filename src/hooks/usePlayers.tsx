import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { Court, Player } from '../types';
import { engine, getEngineType, setEngine } from '../engines/engineSelector';
import { levelTracker } from '../engines/LevelTracker';
import { storageManager } from '../utils/StorageManager';

interface PlayersContextValue {
  players: Player[];
  playersFrom: (ids: string[] | undefined) => Player[];
}

const PlayersContext = createContext<PlayersContextValue>({
  players: [],
  playersFrom: () => [],
});

export const PlayersProvider: React.FC<{ value: Player[]; children: React.ReactNode }> = ({ value, children }) => {
  const ctx = useMemo<PlayersContextValue>(
    () => ({
      players: value,
      playersFrom: (ids) => (ids ?? []).map(id => value.find(p => p.id === id)).filter((p): p is Player => p !== undefined),
    }),
    [value],
  );
  return <PlayersContext.Provider value={ctx}>{children}</PlayersContext.Provider>;
};

export function usePlayers(): PlayersContextValue {
  return useContext(PlayersContext);
}

interface AppStateContextValue {
  players: Player[];
  isLoaded: boolean;
  playersFrom: (ids: string[] | undefined) => Player[];
  handlePlayerToggle: (id: string) => void;
  handleAddPlayers: (players: Player[]) => void;
  handleRemovePlayer: (id: string) => void;
  handleUpdatePlayer: (id: string, gender: Player['gender'], level: number) => void;
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  isSmartEngineEnabled: boolean;
  engineStateVersion: number;
  handleToggleSmartEngine: () => void;
  resetEngineHistory: () => void;
  clearAll: () => void;
  applyCourtResults: (courts: Court[]) => Player[];
}

const AppStateContext = createContext<AppStateContextValue>({
  players: [],
  isLoaded: false,
  playersFrom: () => [],
  handlePlayerToggle: () => {},
  handleAddPlayers: () => {},
  handleRemovePlayer: () => {},
  handleUpdatePlayer: () => {},
  setPlayers: () => {},
  isSmartEngineEnabled: false,
  engineStateVersion: 0,
  handleToggleSmartEngine: () => {},
  resetEngineHistory: () => {},
  clearAll: () => {},
  applyCourtResults: () => [],
});

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isSmartEngineEnabled, setIsSmartEngineEnabled] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [engineStateVersion, setEngineStateVersion] = useState(0);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      const loadedState = await storageManager.loadApp();
      if (loadedState.players?.length) setPlayers(loadedState.players);
      const smart = loadedState.isSmartEngineEnabled ?? false;
      if (smart) setIsSmartEngineEnabled(true);
      const engineType = smart ? 'sl' : 'sa';
      setEngine(engineType);
      await engine().loadState(engineType);
      setEngineStateVersion(prev => prev + 1);
      hasLoadedRef.current = true;
      setIsLoaded(true);
    };
    load();
    return engine().onStateChange(() => setEngineStateVersion(prev => prev + 1));
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    storageManager.saveApp({ players });
  }, [players]);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    storageManager.saveApp({ isSmartEngineEnabled });
    engine().saveState(getEngineType());
  }, [isSmartEngineEnabled]);

  const playersFrom = useCallback(
    (ids: string[] | undefined) =>
      (ids ?? []).map(id => players.find(p => p.id === id)).filter((p): p is Player => p !== undefined),
    [players],
  );

  const handlePlayerToggle = useCallback((id: string) => {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, isPresent: !p.isPresent } : p));
  }, []);

  const handleAddPlayers = useCallback((newPlayers: Player[]) => {
    setPlayers(prev => [...prev, ...newPlayers]);
  }, []);

  const handleRemovePlayer = useCallback((id: string) => {
    engine().removePlayerHistory(id);
    setPlayers(prev => prev.filter(p => p.id !== id));
  }, []);

  const handleUpdatePlayer = useCallback((id: string, gender: Player['gender'], level: number) => {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, gender, level } : p));
  }, []);

  const handleToggleSmartEngine = useCallback(() => {
    setIsSmartEngineEnabled(prev => {
      const next = !prev;
      setEngine(next ? 'sl' : 'sa');
      return next;
    });
  }, []);

  const resetEngineHistory = useCallback(() => {
    engine().resetHistory();
    engine().saveState(getEngineType());
  }, []);

  const clearAll = useCallback(() => {
    setPlayers([]);
    engine().resetHistory();
    storageManager.clearAll();
  }, []);

  const applyCourtResults = useCallback((courts: Court[]): Player[] => {
    const courtsWithWinners = courts.filter(c => c.winner);
    if (courtsWithWinners.length > 0) {
      engine().recordWins(courtsWithWinners);
    }
    const updatedPlayers = courts.length > 0
      ? levelTracker.updatePlayersLevels(courts, players)
      : players;
    engine().recordLevelSnapshot(updatedPlayers);
    setPlayers(updatedPlayers);
    return updatedPlayers;
  }, [players]);

  const value = useMemo<AppStateContextValue>(() => ({
    players,
    isLoaded,
    playersFrom,
    handlePlayerToggle,
    handleAddPlayers,
    handleRemovePlayer,
    handleUpdatePlayer,
    setPlayers,
    isSmartEngineEnabled,
    engineStateVersion,
    handleToggleSmartEngine,
    resetEngineHistory,
    clearAll,
    applyCourtResults,
  }), [
    players, isLoaded, playersFrom,
    handlePlayerToggle, handleAddPlayers, handleRemovePlayer, handleUpdatePlayer,
    isSmartEngineEnabled, engineStateVersion,
    handleToggleSmartEngine, resetEngineHistory, clearAll, applyCourtResults,
  ]);

  return (
    <AppStateContext.Provider value={value}>
      <PlayersProvider value={players}>
        {children}
      </PlayersProvider>
    </AppStateContext.Provider>
  );
};

export function useAppState(): AppStateContextValue {
  return useContext(AppStateContext);
}
