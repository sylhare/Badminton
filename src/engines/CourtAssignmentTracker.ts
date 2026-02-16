import type { Court, Player, CourtEngineState, ICourtAssignmentTracker, EngineType } from '../types';
import { saveCourtEngineState, loadCourtEngineState } from '../utils/storageUtils';

/**
 * CourtAssignmentTracker
 * 
 * Provides shared telemetry, historical tracking, and persistence.
 * Static members ensure all inherited engines share the same state.
 */
export class CourtAssignmentTracker implements ICourtAssignmentTracker {
    // ============================================================================
    // PERSISTENT STATE - Saved to localStorage across sessions
    // ============================================================================
    // These maps track historical data and are persisted to ensure fair rotation
    // and balanced play across multiple sessions. All engines share this state.

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

    // ============================================================================
    // SESSION STATE - Reset each session, never persisted
    // ============================================================================
    // Tracks which courts have recorded wins during the current round to prevent
    // double-counting if the user changes winners multiple times before generating
    // next round.

    /** Recorded match outcomes for current session (court number → result) */
    protected static recordedWinsMap: Map<number, { winner: 1 | 2; winningPlayers: string[]; losingPlayers: string[] }> = new Map();

    // ============================================================================
    // RUNTIME OPTIMIZATION STATE - Ephemeral, never persisted
    // ============================================================================
    // Timestamps used during runtime for pruning old data when saving. These are
    // rebuilt each session and do not need to be saved to localStorage.

    /** Timestamps for pruning stale pairings - tracks last update time */
    protected static lastUpdatedMap: Map<string, number> = new Map();

    /** Monotonic counter for generating timestamps */
    protected static globalCounter = 0;

    // ============================================================================
    // OBSERVER STATE - Runtime only
    // ============================================================================

    /** Observer pattern listeners for state change notifications */
    private static stateChangeListeners: Array<() => void> = [];

    // ============================================================================
    // PROTECTED ACCESSORS - For internal use by engines
    // ============================================================================
    // These provide convenient access to static maps without requiring the class prefix

    protected get teammateCountMap() { return CourtAssignmentTracker.teammateCountMap; }
    protected get opponentCountMap() { return CourtAssignmentTracker.opponentCountMap; }
    protected get singleCountMap() { return CourtAssignmentTracker.singleCountMap; }
    protected get winCountMap() { return CourtAssignmentTracker.winCountMap; }
    protected get lossCountMap() { return CourtAssignmentTracker.lossCountMap; }

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

    /** Notifies all subscribed listeners of a state change. */
    protected notifyStateChange(): void {
        CourtAssignmentTracker.stateChangeListeners.forEach(listener => listener());
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
        CourtAssignmentTracker.globalCounter = 0;
        this.notifyStateChange();
    }

    /** Clears only the current session's recorded match outcomes. */
    clearCurrentSession(): void {
        CourtAssignmentTracker.recordedWinsMap.clear();
    }

    /** Prepares the internal maps for persistence. Filters and prunes old data. */
    prepareStateForSaving(engineType: EngineType): CourtEngineState {
        // Pruning logic: keep the 500 most recently updated entries across large maps
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
        };
    }

    /** Prunes historical pairings and counts based on recency. */
    private pruneHistoricalData(maxEntries: number): void {
        const pairingKeys = [
            ...CourtAssignmentTracker.teammateCountMap.keys(),
            ...CourtAssignmentTracker.opponentCountMap.keys(),
        ];

        if (pairingKeys.length <= maxEntries) return;

        // Sort keys by their last updated timestamp
        const sortedKeys = pairingKeys.sort((a, b) => {
            const timeA = CourtAssignmentTracker.lastUpdatedMap.get(a) ?? 0;
            const timeB = CourtAssignmentTracker.lastUpdatedMap.get(b) ?? 0;
            return timeB - timeA; // Descending
        });

        const keysToKeep = new Set(sortedKeys.slice(0, maxEntries));

        // Delete keys not in the "keep" set
        pairingKeys.forEach(key => {
            if (!keysToKeep.has(key)) {
                CourtAssignmentTracker.teammateCountMap.delete(key);
                CourtAssignmentTracker.opponentCountMap.delete(key);
                CourtAssignmentTracker.lastUpdatedMap.delete(key);
            }
        });
    }

    /** Saves the current state to persistent storage. */
    saveState(engineType: EngineType): void {
        saveCourtEngineState(this.prepareStateForSaving(engineType));
    }

    /** Loads tracking data from persistent storage. */
    loadState(currentEngineType: EngineType): void {
        const state = loadCourtEngineState();

        if (state.engineType && state.engineType !== currentEngineType) {
            console.warn(
                `[Engine Storage] Engine changed from ${state.engineType} to ${currentEngineType}. ` +
                `Resetting history to avoid inconsistent cost evaluation.`
            );
            this.resetHistory();
            return;
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
    }

    /**
     * Records wins and losses for a set of matches.
     */
    getStats(): any {
        const teammateValues = Array.from(CourtAssignmentTracker.teammateCountMap.values());
        const opponentValues = Array.from(CourtAssignmentTracker.opponentCountMap.values());
        return {
            winCountMap: new Map(CourtAssignmentTracker.winCountMap),
            lossCountMap: new Map(CourtAssignmentTracker.lossCountMap),
            teammateCountMap: new Map(CourtAssignmentTracker.teammateCountMap),
            opponentCountMap: new Map(CourtAssignmentTracker.opponentCountMap),
            benchCountMap: new Map(CourtAssignmentTracker.benchCountMap),
            singleCountMap: new Map(CourtAssignmentTracker.singleCountMap),
            totalTeammatePairs: teammateValues.length,
            maxTeammateCount: Math.max(0, ...teammateValues),
            avgTeammateCount: teammateValues.length > 0 ? teammateValues.reduce((a, b) => a + b, 0) / teammateValues.length : 0,
            totalOpponentPairs: opponentValues.length,
            maxOpponentCount: Math.max(0, ...opponentValues),
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
            CourtAssignmentTracker.globalCounter++; // Increment "time"
            this.notifyStateChange();
        }
    }

    /**
     * Reverses a previously recorded win for a specific court.
     */
    reverseWinForCourt(courtNumber: number): void {
        const previousRecord = CourtAssignmentTracker.recordedWinsMap.get(courtNumber);
        if (previousRecord) {
            this.reversePreviousWinRecord(previousRecord);
            CourtAssignmentTracker.recordedWinsMap.delete(courtNumber);
            this.notifyStateChange();
        }
    }

    /**
     * Updates the winner of a match and records the result.
     */
    updateWinner(
        courtNumber: number,
        winner: 1 | 2 | undefined,
        currentAssignments: Court[],
    ): Court[] {
        const court = currentAssignments.find(c => c.courtNumber === courtNumber);
        if (!court) return currentAssignments;

        if (court.winner && court.winner !== winner) {
            this.reverseWinForCourt(courtNumber);
        }

        const updatedAssignments = currentAssignments.map(c =>
            c.courtNumber === courtNumber ? { ...c, winner } : c,
        );

        if (winner && court.teams) {
            this.recordWins([{ ...court, winner }]);
        }

        this.notifyStateChange();
        return updatedAssignments;
    }

    /**
     * Private helper to check if a win record has changed.
     */
    private shouldReversePreviousRecord(
        previousRecord: { winner: 1 | 2; winningPlayers: string[]; losingPlayers: string[] },
        currentWinner: 1 | 2,
        currentWinningPlayerIds: string[]
    ): boolean {
        return !(previousRecord.winner === currentWinner &&
            JSON.stringify(previousRecord.winningPlayers.sort()) === JSON.stringify(currentWinningPlayerIds.sort()));
    }

    /**
     * Undoes the impact of a win record on player statistics.
     */
    private reversePreviousWinRecord(
        previousRecord: { winner: 1 | 2; winningPlayers: string[]; losingPlayers: string[] }
    ): void {
        previousRecord.winningPlayers.forEach(playerId => {
            const currentWins = CourtAssignmentTracker.winCountMap.get(playerId) || 0;
            if (currentWins > 0) {
                CourtAssignmentTracker.winCountMap.set(playerId, currentWins - 1);
            }
        });

        previousRecord.losingPlayers.forEach(playerId => {
            const currentLosses = CourtAssignmentTracker.lossCountMap.get(playerId) || 0;
            if (currentLosses > 0) {
                CourtAssignmentTracker.lossCountMap.set(playerId, currentLosses - 1);
            }
        });
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

    /**
     * Records a teammate pairing.
     */
    recordTeammatePair(p1: string, p2: string): void {
        const key = this.pairKey(p1, p2);
        this.incrementMapCount(CourtAssignmentTracker.teammateCountMap, key);
        this.updateTimestamp(key);
    }

    /**
     * Records an opponent pairing.
     */
    recordOpponentPair(p1: string, p2: string): void {
        const key = this.pairKey(p1, p2);
        this.incrementMapCount(CourtAssignmentTracker.opponentCountMap, key);
        this.updateTimestamp(key);
    }

    /**
     * Increments map count.
     */
    protected incrementMapCount(map: Map<string, number>, key: string, inc = 1): void {
        map.set(key, (map.get(key) ?? 0) + inc);
    }

    /** Updates the last seen timestamp for a key */
    protected updateTimestamp(key: string): void {
        CourtAssignmentTracker.lastUpdatedMap.set(key, CourtAssignmentTracker.globalCounter);
    }

    /**
     * Generates a sorted pair key for teammate/opponent maps.
     */
    protected pairKey(a: string, b: string): string {
        return a < b ? `${a}|${b}` : `${b}|${a}`;
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

    // --- ICourtAssignmentEngine Getters ---

    getWinCounts(): Map<string, number> {
        return new Map(CourtAssignmentTracker.winCountMap);
    }

    getLossCounts(): Map<string, number> {
        return new Map(CourtAssignmentTracker.lossCountMap);
    }

    getBenchCounts(): Map<string, number> {
        return new Map(CourtAssignmentTracker.benchCountMap);
    }

    getBenchedPlayers(assignments: Court[], players: Player[]): Player[] {
        const assignedIds = new Set(assignments.flatMap(c => c.players.map(p => p.id)));
        return players.filter(p => p.isPresent && !assignedIds.has(p.id));
    }

}
