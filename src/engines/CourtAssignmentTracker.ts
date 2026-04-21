import type {
  Court,
  CourtEngineState,
  EngineType,
  ICourtAssignmentTracker,
  Player,
  TrackerStats,
  UpdateWinnerParams,
} from '../types';
import { MAX_LEVEL_HISTORY_ENTRIES, storageManager } from '../utils/StorageManager';
import { opponentPairs, teamPairs } from '../utils/playerUtils';

import { levelTracker } from './LevelTracker';

/**
 * CourtAssignmentTracker
 *
 * Provides shared telemetry, historical tracking, and persistence.
 * Static members ensure all inherited engines share the same state.
 */
export class CourtAssignmentTracker implements ICourtAssignmentTracker {

  private static readonly PAIR_HISTORY_TTL_MS = 5 * 24 * 60 * 60 * 1000;

  /** Player bench counts - tracks how many times each player was benched */
  protected static benchCountMap: Map<string, number> = new Map();

  /** Singles match counts - tracks singles play for fair rotation */
  protected static singleCountMap: Map<string, number> = new Map();

  /** Teammate pair frequencies - avoids repeating partner combinations */
  protected static teammateCountMap: Map<string, number> = new Map();

  /** Opponent pair frequencies - varies opponent matchups */
  protected static opponentCountMap: Map<string, number> = new Map();

  /** Total wins per player - used for team balancing */
  protected static winCountMap: Map<string, number> = new Map();

  /** Total losses per player - used for team balancing */
  protected static lossCountMap: Map<string, number> = new Map();

  /** Recorded match outcomes for current session (court number → result) */
  protected static recordedWinsMap: Map<number, {
    winner: 1 | 2;
    winningPlayers: string[];
    losingPlayers: string[]
  }> = new Map();

  /** Level history per player - tracks level after each round snapshot */
  protected static levelHistoryMap: Map<string, number[]> = new Map();

  private static readonly MAX_LEVEL_HISTORY = MAX_LEVEL_HISTORY_ENTRIES;

  /** Timestamps for pruning stale pairings - tracks last update time */
  protected static lastUpdatedMap: Map<string, number> = new Map();

  /** Monotonic counter for generating timestamps */
  protected static globalCounter = 0;

  /** Count of rounds where a winner was committed — used for "Rounds Played" display */
  private static roundsPlayed = 0;

  /** Observer pattern listeners for state change notifications */
  private static stateChangeListeners: Array<() => void> = [];

  static readonly REGENERATION_DEBOUNCE_MS = 2 * 60 * 1000;

  /** Court numbers whose team-pair stats were already updated via rotation this round */
  private pendingRotatedCourts = new Set<number>();

  /** Delta of stats recorded in the most recent generate() call, used to undo on replace */
  private lastRoundDelta: { bench: string[]; singles: string[]; teammates: string[]; opponents: string[] } | null = null;

  /** Timestamp of the most recent generate() call, used to detect rapid regeneration */
  protected lastGeneratedAt: number | undefined = undefined;

  protected get teammateCountMap(): Map<string, number> {
    return CourtAssignmentTracker.teammateCountMap;
  }

  protected get opponentCountMap(): Map<string, number> {
    return CourtAssignmentTracker.opponentCountMap;
  }

  protected get singleCountMap(): Map<string, number> {
    return CourtAssignmentTracker.singleCountMap;
  }

  protected get winCountMap(): Map<string, number> {
    return CourtAssignmentTracker.winCountMap;
  }

  protected get lossCountMap(): Map<string, number> {
    return CourtAssignmentTracker.lossCountMap;
  }

  /**
   * Subscribes to state changes in the tracker (Observer pattern).
   */
  onStateChange(listener: () => void): () => void {
    CourtAssignmentTracker.stateChangeListeners.push(listener);
    return () => {
      const index = CourtAssignmentTracker.stateChangeListeners.indexOf(listener);
      if (index > -1) {
        CourtAssignmentTracker.stateChangeListeners.splice(index, 1);
      }
    };
  }

  /** Resets all historical tracking data. */
  resetHistory(): void {
    CourtAssignmentTracker.benchCountMap.clear();
    CourtAssignmentTracker.singleCountMap.clear();
    CourtAssignmentTracker.teammateCountMap.clear();
    CourtAssignmentTracker.opponentCountMap.clear();
    CourtAssignmentTracker.winCountMap.clear();
    CourtAssignmentTracker.lossCountMap.clear();
    CourtAssignmentTracker.recordedWinsMap.clear();
    CourtAssignmentTracker.lastUpdatedMap.clear();
    CourtAssignmentTracker.levelHistoryMap.clear();
    CourtAssignmentTracker.globalCounter = 0;
    CourtAssignmentTracker.roundsPlayed = 0;
    this.lastRoundDelta = null;
    this.lastGeneratedAt = undefined;
    this.notifyStateChange();
  }

  /** Increments roundsPlayed if the current session had at least one winner. */
  protected markRoundCompleted(): void {
    if (CourtAssignmentTracker.recordedWinsMap.size > 0) {
      CourtAssignmentTracker.roundsPlayed++;
    }
  }

  /**
   * Returns true if the previous round's results should be committed before generating.
   * False when this is a rapid regeneration with no winners (discard the previous trial round).
   * Must be called before generate() so recordedWinsMap reflects the previous round.
   */
  protected shouldCommitRound(): boolean {
    const isRapidRegeneration =
      this.lastGeneratedAt !== undefined &&
      Date.now() - this.lastGeneratedAt < CourtAssignmentTracker.REGENERATION_DEBOUNCE_MS;
    const hasWinners = CourtAssignmentTracker.recordedWinsMap.size > 0;
    return !isRapidRegeneration || hasWinners;
  }

  /** Removes all historical tracking data for a specific player. */
  removePlayerHistory(playerId: string): void {
    CourtAssignmentTracker.winCountMap.delete(playerId);
    CourtAssignmentTracker.lossCountMap.delete(playerId);
    CourtAssignmentTracker.benchCountMap.delete(playerId);
    CourtAssignmentTracker.singleCountMap.delete(playerId);
    this.notifyStateChange();
  }

  /** Clears only the current session's recorded match outcomes. */
  clearCurrentSession(): void {
    CourtAssignmentTracker.recordedWinsMap.clear();
    this.pendingRotatedCourts.clear();
    this.lastGeneratedAt = undefined;
  }

  /**
   * Records bench/singles/teammate/opponent stats for a round.
   * Called from generate() so stats are immediately visible after generation.
   * Tracks a delta so undoLastRound() can reverse it on rapid re-generation.
   */
  applyRoundStats(courts: Court[], players: Player[]): void {
    const delta = { bench: [] as string[], singles: [] as string[], teammates: [] as string[], opponents: [] as string[] };

    this.benchedPlayers(courts, players).forEach(p => {
      this.recordBenching(p.id);
      delta.bench.push(p.id);
    });

    courts.forEach(court => {
      if (!court.teams) return;

      if (court.players.length === 2) {
        court.players.forEach(p => {
          this.recordSingles(p.id);
          delta.singles.push(p.id);
        });
      }

      if (!this.pendingRotatedCourts.has(court.courtNumber)) {
        this.updateCourtTeamStats(court);
        const { team1, team2 } = court.teams;
        for (const team of [team1, team2]) {
          delta.teammates.push(...teamPairs(team));
        }
        delta.opponents.push(...opponentPairs(team1, team2));
      }
    });

    this.lastRoundDelta = delta;
  }

  /** Reverses the stats recorded by the most recent applyRoundStats call. */
  protected undoLastRound(): void {
    if (!this.lastRoundDelta) return;
    const { bench, singles, teammates, opponents } = this.lastRoundDelta;
    bench.forEach(id => this.decrementMapCount(CourtAssignmentTracker.benchCountMap, id));
    singles.forEach(id => this.decrementMapCount(CourtAssignmentTracker.singleCountMap, id));
    teammates.forEach(key => this.decrementMapCount(CourtAssignmentTracker.teammateCountMap, key));
    opponents.forEach(key => this.decrementMapCount(CourtAssignmentTracker.opponentCountMap, key));
    this.lastRoundDelta = null;
  }

  /** Prepares the internal maps for persistence. Filters and prunes old data. */
  prepareStateForSaving(engineType: EngineType): CourtEngineState {
    const MAX_ENTRIES = 500;
    this.pruneHistoricalData(MAX_ENTRIES);

    return {
      engineType,
      benchCountMap: Object.fromEntries(CourtAssignmentTracker.benchCountMap),
      singleCountMap: Object.fromEntries(CourtAssignmentTracker.singleCountMap),
      teammateCountMap: Object.fromEntries(CourtAssignmentTracker.teammateCountMap),
      opponentCountMap: Object.fromEntries(CourtAssignmentTracker.opponentCountMap),
      winCountMap: Object.fromEntries(CourtAssignmentTracker.winCountMap),
      lossCountMap: Object.fromEntries(CourtAssignmentTracker.lossCountMap),
      levelHistory: Object.fromEntries(CourtAssignmentTracker.levelHistoryMap),
      roundsPlayed: CourtAssignmentTracker.roundsPlayed,
    };
  }

  /** Saves the current state to persistent storage. */
  async saveState(engineType: EngineType): Promise<void> {
    await storageManager.saveEngine(this.prepareStateForSaving(engineType));
  }

  /** Loads tracking data from persistent storage. */
  async loadState(currentEngineType: EngineType): Promise<void> {
    const state = await storageManager.loadEngine();
    const { savedAt } = state;

    if (state.engineType && state.engineType !== currentEngineType) {
      console.warn(`[Engine Storage] Engine changed from ${state.engineType} to ${currentEngineType}.`);
    }

    if (state.benchCountMap) {
      CourtAssignmentTracker.benchCountMap = new Map(Object.entries(state.benchCountMap));
    }
    if (state.singleCountMap) {
      CourtAssignmentTracker.singleCountMap = new Map(Object.entries(state.singleCountMap));
    }
    if (state.teammateCountMap) {
      CourtAssignmentTracker.teammateCountMap = new Map(Object.entries(state.teammateCountMap));
    }
    if (state.opponentCountMap) {
      CourtAssignmentTracker.opponentCountMap = new Map(Object.entries(state.opponentCountMap));
    }
    if (state.winCountMap) {
      CourtAssignmentTracker.winCountMap = new Map(Object.entries(state.winCountMap));
    }
    if (state.lossCountMap) {
      CourtAssignmentTracker.lossCountMap = new Map(Object.entries(state.lossCountMap));
    }
    if (state.levelHistory) {
      CourtAssignmentTracker.levelHistoryMap = new Map(
        Object.entries(state.levelHistory) as [string, number[]][],
      );
    }
    if (state.roundsPlayed !== undefined) {
      CourtAssignmentTracker.roundsPlayed = Math.max(
        CourtAssignmentTracker.roundsPlayed,
        state.roundsPlayed,
      );
    }

    if (currentEngineType === 'sa' && savedAt !== undefined) {
      if (Date.now() - savedAt > CourtAssignmentTracker.PAIR_HISTORY_TTL_MS) {
        this.clearPairHistory();
      }
    }
  }

  private clearPairHistory(): void {
    CourtAssignmentTracker.teammateCountMap.clear();
    CourtAssignmentTracker.opponentCountMap.clear();
    CourtAssignmentTracker.lastUpdatedMap.clear();
    CourtAssignmentTracker.benchCountMap.clear();
  }

  /**
   * Returns tracking statistics as Maps.
   */
  levelTrend(playerId: string): 'up' | 'down' | null {
    return levelTracker.getLevelTrend(playerId, CourtAssignmentTracker.levelHistoryMap);
  }

  stats(): TrackerStats {
    return {
      winCountMap: new Map(CourtAssignmentTracker.winCountMap),
      lossCountMap: new Map(CourtAssignmentTracker.lossCountMap),
      teammateCountMap: new Map(CourtAssignmentTracker.teammateCountMap),
      opponentCountMap: new Map(CourtAssignmentTracker.opponentCountMap),
      benchCountMap: new Map(CourtAssignmentTracker.benchCountMap),
      singleCountMap: new Map(CourtAssignmentTracker.singleCountMap),
      roundsPlayed: CourtAssignmentTracker.roundsPlayed,
    };
  }

  recordWins(courts: Court[]): void {
    let stateChanged = false;
    courts.forEach(court => {
      if (court.winner && court.teams) {
        const courtNumber = court.courtNumber;
        const winningTeam = court.winner === 1 ? court.teams.team1 : court.teams.team2;
        const losingTeam = court.winner === 1 ? court.teams.team2 : court.teams.team1;
        const winningPlayerIds = winningTeam.map(p => p.id);
        const losingPlayerIds = losingTeam.map(p => p.id);

        const previousRecord = CourtAssignmentTracker.recordedWinsMap.get(courtNumber);

        if (previousRecord && this.shouldReversePreviousRecord(previousRecord, court.winner, winningPlayerIds)) {
          this.reversePreviousWinRecord(previousRecord);
          stateChanged = true;
        } else if (previousRecord) {
          return;
        }

        winningTeam.forEach(player => {
          this.incrementMapCount(CourtAssignmentTracker.winCountMap, player.id);
          this.updateTimestamp(player.id);
        });
        losingTeam.forEach(player => {
          this.incrementMapCount(CourtAssignmentTracker.lossCountMap, player.id);
          this.updateTimestamp(player.id);
        });

        CourtAssignmentTracker.recordedWinsMap.set(courtNumber, {
          winner: court.winner,
          winningPlayers: winningPlayerIds,
          losingPlayers: losingPlayerIds,
        });
        stateChanged = true;
      }
    });

    if (stateChanged) {
      CourtAssignmentTracker.globalCounter++;
      this.notifyStateChange();
    }
  }

  /** Records a level snapshot for all players after a round. */
  recordLevelSnapshot(players: Player[]): void {
    for (const p of players) {
      const history = CourtAssignmentTracker.levelHistoryMap.get(p.id) ?? [];
      history.push(p.level ?? 50);
      if (history.length > CourtAssignmentTracker.MAX_LEVEL_HISTORY) history.shift();
      CourtAssignmentTracker.levelHistoryMap.set(p.id, history);
    }
    this.notifyStateChange();
  }

  /**
   * Records teammate and opponent pairing stats for a court.
   * If previousCourt is provided, its stats are reversed first (used on rotation).
   */
  private updateCourtTeamStats(court: Court, previousCourt?: Court): void {
    if (previousCourt?.teams) {
      const { team1, team2 } = previousCourt.teams;
      this.decrementTeamPairs(team1);
      this.decrementTeamPairs(team2);
      opponentPairs(team1, team2).forEach(k => this.decrementMapCount(CourtAssignmentTracker.opponentCountMap, k));
    }

    if (court.teams) {
      const { team1, team2 } = court.teams;
      [team1, team2].forEach(team => this.recordTeamPairs(team));
      opponentPairs(team1, team2).forEach(k => {
        this.incrementMapCount(CourtAssignmentTracker.opponentCountMap, k);
        this.updateTimestamp(k);
      });
    }

    this.notifyStateChange();
  }

  /**
   * Reverses a previously recorded win for a specific court.
   */
  private reverseWinForCourt(courtNumber: number): void {
    const previousRecord = CourtAssignmentTracker.recordedWinsMap.get(courtNumber);
    if (previousRecord) {
      this.reversePreviousWinRecord(previousRecord);
      CourtAssignmentTracker.recordedWinsMap.delete(courtNumber);
    }
  }

  /**
   * Updates the winner of a match and records the result.
   * If rotatedCourt is provided, applies the rotation and updates team pairing stats.
   */
  updateWinner({ courtNumber, winner, currentAssignments, rotatedCourt }: UpdateWinnerParams): Court[] {
    const court = currentAssignments.find(c => c.courtNumber === courtNumber);
    if (!court) return currentAssignments;

    if (court.winner && court.winner !== winner) {
      this.reverseWinForCourt(courtNumber);
    }

    const updatedAssignments = currentAssignments.map(c =>
      c.courtNumber === courtNumber ? (rotatedCourt ?? { ...c, winner }) : c,
    );

    if (winner && court.teams) {
      this.recordWins([{ ...court, winner }]);
    }

    if (rotatedCourt) {
      this.pendingRotatedCourts.add(courtNumber);
      this.updateCourtTeamStats(rotatedCourt, court);
    }

    this.notifyStateChange();
    return updatedAssignments;
  }

  /**
   * Records the benching of a player.
   */
  recordBenching(playerId: string): void {
    this.incrementMapCount(CourtAssignmentTracker.benchCountMap, playerId);
  }

  /**
   * Records a singles match for a player.
   */
  recordSingles(playerId: string): void {
    this.incrementMapCount(CourtAssignmentTracker.singleCountMap, playerId);
    this.updateTimestamp(playerId);
  }

  benchedPlayers(assignments: Court[], players: Player[]): Player[] {
    const assignedIds = new Set(assignments.flatMap(c => c.players.map(p => p.id)));
    return players.filter(p => p.isPresent && !assignedIds.has(p.id));
  }

  /** Notifies all subscribed listeners of a state change. */
  protected notifyStateChange(): void {
    CourtAssignmentTracker.stateChangeListeners.forEach(listener => listener());
  }

  /**
   * Increments map count.
   */
  protected incrementMapCount(map: Map<string, number>, key: string, inc = 1): void {
    map.set(key, (map.get(key) ?? 0) + inc);
  }

  private decrementMapCount(map: Map<string, number>, key: string): void {
    const count = map.get(key) ?? 0;
    if (count > 0) map.set(key, count - 1);
  }

  private recordTeamPairs(team: Player[]): void {
    teamPairs(team).forEach(k => {
      this.incrementMapCount(CourtAssignmentTracker.teammateCountMap, k);
      this.updateTimestamp(k);
    });
  }

  private decrementTeamPairs(team: Player[]): void {
    teamPairs(team).forEach(k => this.decrementMapCount(CourtAssignmentTracker.teammateCountMap, k));
  }

  /** Updates the last seen timestamp for a key */
  protected updateTimestamp(key: string): void {
    CourtAssignmentTracker.lastUpdatedMap.set(key, CourtAssignmentTracker.globalCounter);
  }

  /**
   * Shuffles an array in place (Fisher-Yates).
   */
  protected shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
    return array;
  }

  /**
   * Selects which players should be benched.
   */
  protected selectBenchedPlayers(players: Player[], benchSpots: number): Player[] {
    if (benchSpots <= 0) return [];

    const shuffled = this.shuffleArray([...players]);
    return shuffled.sort((a, b) => {
      const countA = CourtAssignmentTracker.benchCountMap.get(a.id) ?? 0;
      const countB = CourtAssignmentTracker.benchCountMap.get(b.id) ?? 0;
      return countA - countB;
    }).slice(0, benchSpots);
  }

  /**
   * Creates a court for manual selection.
   */
  protected createManualCourt(players: Player[], courtNumber: number, teamSplitter?: (players: Player[]) => Court['teams']): Court {
    const court: Court = { courtNumber, players: [...players] };

    if (players.length === 4 && teamSplitter) {
      court.teams = teamSplitter(players);
    } else if (players.length >= 2) {
      court.teams = { team1: [players[0]], team2: [players[1]] };
    }

    return court;
  }

  /** Prunes historical pairings and counts based on recency. */
  private pruneHistoricalData(maxEntries: number): void {
    const pairingKeys = [
      ...CourtAssignmentTracker.teammateCountMap.keys(),
      ...CourtAssignmentTracker.opponentCountMap.keys(),
    ];

    if (pairingKeys.length <= maxEntries) return;

    const sortedKeys = pairingKeys.sort((a, b) => {
      const timeA = CourtAssignmentTracker.lastUpdatedMap.get(a) ?? 0;
      const timeB = CourtAssignmentTracker.lastUpdatedMap.get(b) ?? 0;
      return timeB - timeA;
    });

    const keysToKeep = new Set(sortedKeys.slice(0, maxEntries));

    pairingKeys.forEach(key => {
      if (!keysToKeep.has(key)) {
        CourtAssignmentTracker.teammateCountMap.delete(key);
        CourtAssignmentTracker.opponentCountMap.delete(key);
        CourtAssignmentTracker.lastUpdatedMap.delete(key);
      }
    });
  }

  /**
   * Private helper to check if a win record has changed.
   */
  private shouldReversePreviousRecord(
    previousRecord: { winner: 1 | 2; winningPlayers: string[]; losingPlayers: string[] },
    currentWinner: 1 | 2,
    currentWinningPlayerIds: string[],
  ): boolean {
    return !(previousRecord.winner === currentWinner &&
      JSON.stringify([...previousRecord.winningPlayers].sort()) === JSON.stringify([...currentWinningPlayerIds].sort()));
  }

  /**
   * Undoes the impact of a win record on player statistics.
   */
  private reversePreviousWinRecord(
    previousRecord: { winner: 1 | 2; winningPlayers: string[]; losingPlayers: string[] },
  ): void {
    previousRecord.winningPlayers.forEach(playerId => {
      this.decrementMapCount(CourtAssignmentTracker.winCountMap, playerId);
    });
    previousRecord.losingPlayers.forEach(playerId => {
      this.decrementMapCount(CourtAssignmentTracker.lossCountMap, playerId);
    });
  }

}
