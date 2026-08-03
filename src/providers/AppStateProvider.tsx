import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { engine, getEngineType, setEngine, enginePersistence } from '../engines/engineSelector';
import { levelTracker } from '../engines/LevelTracker';
import type { Court, EngineSnapshot, GenerateResult, Player, ScoredGame, UpdateWinnerParams } from '../types';
import { useAnalytics } from '../hooks/useAnalytics';
import { createPlayersFromNames } from '../utils/playerUtils';
import { storageManager } from '../utils/StorageManager';
import { EliminationTournament } from '../tournament/EliminationTournament';
import { RoundRobinTournament } from '../tournament/RoundRobinTournament';
import { GroupKnockoutTournament } from '../tournament/GroupKnockoutTournament';
import type { TournamentState } from '../tournament/types';

/** A reconstructed tournament instance of any supported format. */
export type AnyTournament = RoundRobinTournament | EliminationTournament | GroupKnockoutTournament;

/** Rebuild the concrete tournament class from persisted state. */
export function reconstructTournament(state: TournamentState): AnyTournament {
  switch (state.type) {
    case 'elimination':
      return EliminationTournament.fromState(state);
    case 'group-knockout':
      return GroupKnockoutTournament.fromState(state);
    default:
      return RoundRobinTournament.fromState(state);
  }
}

/** App-state context shape. Lives here, not core `types/`, to avoid a core→feature type dependency. */
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
  applyGameResults(games: ScoredGame[], base?: Player[]): void;
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
          setTournament(reconstructTournament(savedTournament));
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

  const handleAddPlayers = useCallback((names: string[]) => {
    const newPlayers = createPlayersFromNames(names, 'manual');
    setPlayers(prev => [...prev, ...newPlayers]);
  }, []);

  const handlePlayerToggle = useCallback((id: string) => {
    setPlayers(prev =>
      prev.map(p => p.id === id ? { ...p, isPresent: !p.isPresent } : p),
    );
  }, []);

  const handleRemovePlayer = useCallback((id: string) => {
    engine().removePlayerHistory(id);
    setPlayers(prev => prev.filter(p => p.id !== id));
  }, []);

  const handleUpdatePlayer = useCallback((id: string, gender: Player['gender'], level: number) => {
    setPlayers(prev =>
      prev.map(p => p.id === id ? { ...p, gender, level } : p),
    );
  }, []);

  const clearPlayers = useCallback(() => {
    setPlayers([]);
    setTournament(null);
    engine().resetHistory();
    storageManager.clearAll();
  }, []);

  const handleToggleSmartEngine = useCallback(() => {
    if (!isLoaded) return;
    const next = !isSmartEngineEnabled;
    setIsSmartEngineEnabled(next);
    setEngine(next ? 'sl' : 'sa');
    syncFromEngine();
  }, [isLoaded, isSmartEngineEnabled, syncFromEngine]);

  /** Single path for level changes: replays decided `games` on `base`, merges level fields onto the live roster. */
  const applyGameResults = useCallback((games: ScoredGame[], base: Player[] = players) => {
    const scored = games.filter(g => g.court.winner);
    if (scored.length === 0) {
      engine().recordLevelSnapshot(players.filter(p => p.isPresent));
      return;
    }
    const replayed = new Map(levelTracker.updatePlayersLevels(scored, base).map(p => [p.id, p]));
    let changed = false;
    const next = players.map(p => {
      const r = replayed.get(p.id);
      if (!r || (r.level === p.level && r.averageScore === p.averageScore && r.scoredGames === p.scoredGames)) return p;
      changed = true;
      return { ...p, level: r.level, averageScore: r.averageScore, scoredGames: r.scoredGames };
    });
    if (!changed) return;
    engine().recordLevelSnapshot(next.filter(p => p.isPresent));
    setPlayers(next);
  }, [players]);

  const generate = useCallback((
    players: Player[],
    numberOfCourts: number,
    previousAssignments: Court[],
    forceBenchPlayerIds?: Set<string>,
  ): GenerateResult => {
    const result = engine().generate(players, numberOfCourts, forceBenchPlayerIds);
    if (result.committed) applyGameResults(previousAssignments.map(court => ({ court })));

    result.anomalies.forEach(trackAssignmentAnomaly);

    return result;
  }, [applyGameResults, trackAssignmentAnomaly]);

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

  const value = useMemo<AppStateContextType>(() => ({
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
    applyGameResults,
    tournament,
    setTournament,
    saveState,
    resetAlgorithm,
    engineName: engine().name,
    engineDescription: engine().description,
  }), [
    players, numberOfCourts, assignments, lastGeneratedAt, isLoaded,
    isSmartEngineEnabled, counts, engineState, tournament,
    handlePlayerToggle, handleAddPlayers, handleRemovePlayer, handleUpdatePlayer,
    clearPlayers, handleToggleSmartEngine, levelTrend, generate, updateWinner,
    applyManualEdit, applyGameResults, saveState, resetAlgorithm,
  ]);

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}
