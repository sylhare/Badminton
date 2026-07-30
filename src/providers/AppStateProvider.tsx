import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { engine, getEngineType, setEngine, enginePersistence } from '../engines/engineSelector';
import { levelTracker } from '../engines/LevelTracker';
import type { Court, EngineSnapshot, GenerateResult, Player, ScoredGame, UpdateWinnerParams } from '../types';
import { useAnalytics } from '../hooks/useAnalytics';
import { createPlayersFromNames } from '../utils/playerUtils';
import { storageManager } from '../utils/StorageManager';
import { EliminationTournament } from '../tournament/EliminationTournament';
import { RoundRobinTournament } from '../tournament/RoundRobinTournament';

/** A reconstructed tournament instance of either supported format. */
export type AnyTournament = RoundRobinTournament | EliminationTournament;

/**
 * Shape of the app-state context. Lives here (not in core `types/`) because it
 * references application-layer types like {@link AnyTournament}; keeping it in
 * core would force domain types to depend on feature modules.
 */
export interface AppStateContextType {
  players: Player[];
  numberOfCourts: number;
  setNumberOfCourts: React.Dispatch<React.SetStateAction<number>>;
  assignments: Court[];
  setAssignments: React.Dispatch<React.SetStateAction<Court[]>>;
  lastGeneratedAt?: number;
  setLastGeneratedAt: React.Dispatch<React.SetStateAction<number | undefined>>;
  isLoaded: boolean;
  handlePlayerToggle: (id: string) => void;
  handleAddPlayers: (names: string[]) => void;
  handleRemovePlayer: (id: string) => void;
  handleUpdatePlayer: (id: string, gender: Player['gender'], level: number) => void;
  clearPlayers: () => void;
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  isSmartEngineEnabled: boolean;
  handleToggleSmartEngine: () => void;
  winCounts: Map<string, number>;
  lossCounts: Map<string, number>;
  benchCounts: Map<string, number>;
  engineState: EngineSnapshot | null;
  levelTrend: (playerId: string) => 'up' | 'down' | null;
  generate(players: Player[], numberOfCourts: number, previousAssignments: Court[], forceBenchPlayerIds?: Set<string>): GenerateResult;
  updateWinner(params: UpdateWinnerParams): Court[];
  applyManualEdit(previous: Court[], next: Court[]): Court[];
  applyLevelReplay(baseline: Player[], games: ScoredGame[]): void;
  tournament: AnyTournament | null;
  setTournament: React.Dispatch<React.SetStateAction<AnyTournament | null>>;
  saveState(): Promise<void>;
  resetAlgorithm(): Promise<void>;
  engineName: string;
  engineDescription: string;
}

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
  const [tournament, setTournament] = useState<AnyTournament | null>(null);
  const hasLoadedRef = useRef(false);
  const { trackAssignmentAnomaly } = useAnalytics();

  const syncFromEngine = useCallback(() => {
    const snapshot = engine().snapshot();
    setEngineState(snapshot);
    setCounts({
      wins: new Map(Object.entries(snapshot.winCountMap)),
      losses: new Map(Object.entries(snapshot.lossCountMap)),
      bench: new Map(Object.entries(snapshot.benchCountMap)),
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const hydrate = async () => {
      try {
        const [loadedState, savedTournament] = await Promise.all([
          storageManager.loadApp(),
          storageManager.loadTournament(),
        ]);
        if (loadedState.players?.length) setPlayers(loadedState.players);
        if (loadedState.numberOfCourts !== undefined) setNumberOfCourts(loadedState.numberOfCourts);
        if (loadedState.assignments?.length) setAssignments(loadedState.assignments);
        if (loadedState.lastGeneratedAt !== undefined) setLastGeneratedAt(loadedState.lastGeneratedAt);
        if (savedTournament) {
          setTournament(savedTournament.type === 'elimination'
            ? EliminationTournament.fromState(savedTournament)
            : RoundRobinTournament.fromState(savedTournament));
        }
        const smart = loadedState.isSmartEngineEnabled ?? false;
        if (smart) setIsSmartEngineEnabled(true);
        const engineType = smart ? 'sl' : 'sa';
        setEngine(engineType);
        await engine().loadState(engineType);
      } catch (error) {
        console.warn('AppStateProvider: failed to load persisted state:', error);
      }
    };

    hydrate().then(() => {
      if (cancelled) return;
      cleanup = engine().onStateChange(syncFromEngine);
      hasLoadedRef.current = true;
      setIsLoaded(true);
      syncFromEngine();
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [syncFromEngine]);

  useEffect(() => {
    if (!isLoaded) return;
    return enginePersistence.start();
  }, [isLoaded]);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    storageManager.saveApp({ players, isSmartEngineEnabled, numberOfCourts, assignments, lastGeneratedAt });
  }, [players, isSmartEngineEnabled, numberOfCourts, assignments, lastGeneratedAt]);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    storageManager.saveTournament(tournament?.state() ?? null);
  }, [tournament]);

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

  /** Single write path for level changes: snapshot present players, then update state. */
  const commitLevels = useCallback((snapshotPlayers: Player[], nextPlayers: React.SetStateAction<Player[]>) => {
    engine().recordLevelSnapshot(snapshotPlayers.filter(p => p.isPresent));
    setPlayers(nextPlayers);
  }, []);

  const applyCourtResults = useCallback((courts: Court[]) => {
    const courtsWithWinners = courts.filter(c => c.winner);
    if (courtsWithWinners.length === 0) {
      engine().recordLevelSnapshot(players.filter(p => p.isPresent));
      return;
    }
    const nextPlayers = levelTracker.updatePlayersLevels(courtsWithWinners.map(court => ({ court })), players);
    commitLevels(nextPlayers, nextPlayers);
  }, [players, commitLevels]);

  const applyLevelReplay = useCallback((baseline: Player[], games: ScoredGame[]) => {
    const replayed = levelTracker.updatePlayersLevels(games, baseline);
    const byId = new Map(replayed.map(p => [p.id, p]));
    const changed = players.some(p => {
      const r = byId.get(p.id);
      return r !== undefined && (r.level !== p.level || r.averageScore !== p.averageScore || r.scoredGames !== p.scoredGames);
    });
    if (!changed) return;
    commitLevels(replayed, prev => prev.map(p => {
      const r = byId.get(p.id);
      return r ? { ...p, level: r.level, averageScore: r.averageScore, scoredGames: r.scoredGames } : p;
    }));
  }, [players, commitLevels]);

  const generate = useCallback((
    players: Player[],
    numberOfCourts: number,
    previousAssignments: Court[],
    forceBenchPlayerIds?: Set<string>,
  ): GenerateResult => {
    const result = engine().generate(players, numberOfCourts, forceBenchPlayerIds);
    if (result.committed) applyCourtResults(previousAssignments);

    result.anomalies.forEach(trackAssignmentAnomaly);

    return result;
  }, [applyCourtResults, trackAssignmentAnomaly]);

  const updateWinner = useCallback((params: UpdateWinnerParams): Court[] => {
    return engine().updateWinner(params);
  }, []);

  const applyManualEdit = useCallback((previous: Court[], next: Court[]): Court[] => {
    return engine().applyManualEdit(previous, next, players);
  }, [players]);

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
    applyManualEdit,
    applyLevelReplay,
    tournament,
    setTournament,
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
