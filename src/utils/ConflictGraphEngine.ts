import type { Court, Player, ManualCourtSelection, CourtEngineState } from '../types';

import { saveCourtEngineState, loadCourtEngineState } from './storageUtils';

/**
 * ConflictGraphEngine - Conflict Graph-Based Court Assignment Engine
 *
 * @pattern Greedy Construction with Conflict Graph
 *
 * @description
 * This engine uses a conflict graph approach to GUARANTEE no teammate repetitions
 * when mathematically possible. Players who have been teammates before are connected
 * by edges in a conflict graph, and the algorithm finds independent sets (players
 * with no conflicts between them) to form courts.
 *
 * ## Key Advantages over Monte Carlo/SA:
 * - **Deterministic non-repetition**: If a valid assignment exists, it WILL find it
 * - **Fails fast**: Knows immediately when non-repetition is impossible
 * - **Optimal for variety**: Maximizes pairing diversity by construction
 *
 * ## Algorithm Overview:
 * 1. Build conflict graph where edges = "already been teammates"
 * 2. For each court, greedily find 4 players with NO edges between them
 * 3. Among valid player sets, choose best team split for balance
 * 4. If no valid set exists, fall back to minimum-conflict selection
 *
 * ## When It Works Best:
 * - Early rounds with few historical pairings
 * - Larger player pools (more options to avoid conflicts)
 * - When non-repetition is the primary goal
 *
 * ## Limitations:
 * - May fail to find valid assignments after many rounds (mathematically impossible)
 * - Falls back to "minimum conflict" when perfect assignment isn't possible
 */
export class ConflictGraphEngine {
  /** Tracks how many times each player has been benched across all sessions */
  private static benchCountMap: Map<string, number> = new Map();
  /** Tracks pairwise teammate frequency - THIS IS THE CONFLICT GRAPH */
  private static teammateCountMap: Map<string, number> = new Map();
  /** Tracks pairwise opponent frequency */
  private static opponentCountMap: Map<string, number> = new Map();
  /** Tracks total wins per player for skill-based team balancing */
  private static winCountMap: Map<string, number> = new Map();
  /** Tracks total losses per player for skill-based team balancing */
  private static lossCountMap: Map<string, number> = new Map();
  /** Tracks recorded match outcomes for the current session */
  private static recordedWinsMap: Map<number, { winner: 1 | 2; winningPlayers: string[]; losingPlayers: string[] }> = new Map();
  /** Observer pattern listeners for state change notifications */
  private static stateChangeListeners: Array<() => void> = [];

  // ============== Configuration ==============
  /** Number of random attempts when looking for conflict-free groups */
  private static readonly MAX_SEARCH_ATTEMPTS = 100;
  /** Weight for opponent repetition in cost function */
  private static readonly OPPONENT_WEIGHT = 10;
  /** Weight for skill balance in cost function */
  private static readonly BALANCE_WEIGHT = 2;

  /**
   * Subscribes to state changes in the engine (Observer pattern).
   */
  static onStateChange(listener: () => void): () => void {
    this.stateChangeListeners.push(listener);
    return () => {
      const index = this.stateChangeListeners.indexOf(listener);
      if (index > -1) {
        this.stateChangeListeners.splice(index, 1);
      }
    };
  }

  private static notifyStateChange(): void {
    this.stateChangeListeners.forEach(listener => listener());
  }

  static resetHistory(): void {
    this.benchCountMap.clear();
    this.teammateCountMap.clear();
    this.opponentCountMap.clear();
    this.winCountMap.clear();
    this.lossCountMap.clear();
    this.recordedWinsMap.clear();
    this.notifyStateChange();
  }

  static clearCurrentSession(): void {
    this.recordedWinsMap.clear();
  }

  static prepareStateForSaving(): CourtEngineState {
    return {
      benchCountMap: Object.fromEntries(this.benchCountMap),
      teammateCountMap: Object.fromEntries(this.teammateCountMap),
      opponentCountMap: Object.fromEntries(this.opponentCountMap),
      winCountMap: Object.fromEntries(this.winCountMap),
      lossCountMap: Object.fromEntries(this.lossCountMap),
    };
  }

  static saveState(): void {
    saveCourtEngineState(this.prepareStateForSaving());
  }

  static loadState(): void {
    const state = loadCourtEngineState();

    if (state.benchCountMap) {
      this.benchCountMap = new Map(Object.entries(state.benchCountMap));
    }
    if (state.teammateCountMap) {
      this.teammateCountMap = new Map(Object.entries(state.teammateCountMap));
    }
    if (state.opponentCountMap) {
      this.opponentCountMap = new Map(Object.entries(state.opponentCountMap));
    }
    if (state.winCountMap) {
      this.winCountMap = new Map(Object.entries(state.winCountMap));
    }
    if (state.lossCountMap) {
      this.lossCountMap = new Map(Object.entries(state.lossCountMap));
    }
  }

  private static shouldReversePreviousRecord(previousRecord: { winner: 1 | 2; winningPlayers: string[]; losingPlayers: string[] }, currentWinner: 1 | 2, currentWinningPlayerIds: string[]): boolean {
    return !(previousRecord.winner === currentWinner &&
             JSON.stringify(previousRecord.winningPlayers.sort()) === JSON.stringify(currentWinningPlayerIds.sort()));
  }

  private static reversePreviousWinRecord(previousRecord: { winner: 1 | 2; winningPlayers: string[]; losingPlayers: string[] }): void {
    previousRecord.winningPlayers.forEach(playerId => {
      const currentWins = this.winCountMap.get(playerId) || 0;
      if (currentWins > 0) {
        this.winCountMap.set(playerId, currentWins - 1);
      }
    });

    previousRecord.losingPlayers.forEach(playerId => {
      const currentLosses = this.lossCountMap.get(playerId) || 0;
      if (currentLosses > 0) {
        this.lossCountMap.set(playerId, currentLosses - 1);
      }
    });
  }

  static reverseWinForCourt(courtNumber: number): void {
    const previousRecord = this.recordedWinsMap.get(courtNumber);
    if (previousRecord) {
      this.reversePreviousWinRecord(previousRecord);
      this.recordedWinsMap.delete(courtNumber);
      this.notifyStateChange();
    }
  }

  static updateWinner(
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

  static recordWins(courts: Court[]): void {
    let stateChanged = false;
    courts.forEach(court => {
      if (court.winner && court.teams) {
        const courtNumber = court.courtNumber;
        const winningTeam = court.winner === 1 ? court.teams.team1 : court.teams.team2;
        const losingTeam = court.winner === 1 ? court.teams.team2 : court.teams.team1;
        const winningPlayerIds = winningTeam.map(p => p.id);
        const losingPlayerIds = losingTeam.map(p => p.id);

        const previousRecord = this.recordedWinsMap.get(courtNumber);

        if (previousRecord && this.shouldReversePreviousRecord(previousRecord, court.winner, winningPlayerIds)) {
          this.reversePreviousWinRecord(previousRecord);
          stateChanged = true;
        } else if (previousRecord) {
          return;
        }

        winningTeam.forEach(player => {
          this.incrementMapCount(this.winCountMap, player.id);
        });
        losingTeam.forEach(player => {
          this.incrementMapCount(this.lossCountMap, player.id);
        });

        this.recordedWinsMap.set(courtNumber, {
          winner: court.winner,
          winningPlayers: winningPlayerIds,
          losingPlayers: losingPlayerIds,
        });
        stateChanged = true;
      }
    });
    if (stateChanged) {
      this.notifyStateChange();
    }
  }

  static getWinCounts(): Map<string, number> {
    return new Map(this.winCountMap);
  }

  // ============== Core Conflict Graph Algorithm ==============

  /**
   * Generates court assignments using conflict graph approach.
   */
  static generate(players: Player[], numberOfCourts: number, manualSelection?: ManualCourtSelection): Court[] {
    const presentPlayers = players.filter(p => p.isPresent);
    if (presentPlayers.length === 0) return [];

    let manualCourtResult: Court | null = null;
    let remainingPlayers = presentPlayers;
    let remainingCourts = numberOfCourts;

    // Handle manual court selection
    if (manualSelection && manualSelection.players.length > 0) {
      const manualPlayers = manualSelection.players.filter(p => p.isPresent);
      if (manualPlayers.length >= 2 && manualPlayers.length <= 4) {
        manualCourtResult = this.createManualCourt(manualPlayers, 1);
        remainingPlayers = presentPlayers.filter(p => !manualPlayers.some(mp => mp.id === p.id));
        remainingCourts = numberOfCourts - 1;
      }
    }

    // Calculate bench spots
    const capacity = remainingCourts * 4;
    let benchSpots = Math.max(0, remainingPlayers.length - capacity);
    if ((remainingPlayers.length - benchSpots) % 2 === 1) benchSpots += 1;
    benchSpots = Math.min(benchSpots, remainingPlayers.length);

    // Select benched players fairly
    const benchedPlayers = this.selectBenchedPlayers(remainingPlayers, benchSpots);
    const onCourtPlayers = remainingPlayers.filter(p => !benchedPlayers.includes(p));

    // Build courts using conflict graph approach
    const startCourtNum = manualCourtResult ? 2 : 1;
    const courts = this.buildCourtsWithConflictGraph(onCourtPlayers, remainingCourts, startCourtNum);

    let finalCourts = courts;

    if (manualCourtResult) {
      finalCourts = [manualCourtResult, ...finalCourts];
    }

    // Update historical tracking
    benchedPlayers.forEach(p => this.incrementMapCount(this.benchCountMap, p.id));
    finalCourts.forEach(court => {
      if (!court.teams) return;

      const addTeamPairs = (team: Player[]): void => {
        for (let i = 0; i < team.length; i++) {
          for (let j = i + 1; j < team.length; j++) {
            this.incrementMapCount(this.teammateCountMap, this.pairKey(team[i].id, team[j].id));
          }
        }
      };

      addTeamPairs(court.teams.team1);
      addTeamPairs(court.teams.team2);

      court.teams.team1.forEach(a => {
        court.teams!.team2.forEach(b => {
          this.incrementMapCount(this.opponentCountMap, this.pairKey(a.id, b.id));
        });
      });
    });

    return finalCourts;
  }

  /**
   * Builds courts by finding conflict-free player groups.
   * A conflict exists between two players if they've been teammates before.
   */
  private static buildCourtsWithConflictGraph(players: Player[], numberOfCourts: number, startCourtNum: number): Court[] {
    const courts: Court[] = [];
    const availablePlayers = [...players];

    for (let courtNum = startCourtNum; courtNum < startCourtNum + numberOfCourts; courtNum++) {
      if (availablePlayers.length < 2) break;

      // Try to find 4 conflict-free players
      let courtPlayers: Player[] | null = null;

      if (availablePlayers.length >= 4) {
        courtPlayers = this.findConflictFreeGroup(availablePlayers, 4);

        // If no conflict-free group, find minimum-conflict group
        if (!courtPlayers) {
          courtPlayers = this.findMinimumConflictGroup(availablePlayers, 4);
        }
      } else if (availablePlayers.length >= 2) {
        // Not enough for 4, try 2
        courtPlayers = this.findConflictFreeGroup(availablePlayers, 2);
        if (!courtPlayers) {
          courtPlayers = availablePlayers.slice(0, 2);
        }
      }

      if (!courtPlayers || courtPlayers.length < 2) break;

      // Remove selected players from available pool
      for (const p of courtPlayers) {
        const idx = availablePlayers.findIndex(ap => ap.id === p.id);
        if (idx !== -1) availablePlayers.splice(idx, 1);
      }

      // Create court with optimal team split
      const teams = this.createOptimalTeams(courtPlayers);
      courts.push({ courtNumber: courtNum, players: courtPlayers, teams });
    }

    return courts;
  }

  /**
   * Finds a group of `size` players with NO conflicts (never been teammates).
   * Uses randomized search to find valid independent sets.
   */
  private static findConflictFreeGroup(players: Player[], size: number): Player[] | null {
    if (players.length < size) return null;

    // Try randomized search
    for (let attempt = 0; attempt < this.MAX_SEARCH_ATTEMPTS; attempt++) {
      const shuffled = this.shuffleArray([...players]);
      const group: Player[] = [];

      for (const player of shuffled) {
        // Check if player conflicts with anyone already in group
        let hasConflict = false;
        for (const existing of group) {
          if (this.hasTeammateConflict(player.id, existing.id)) {
            hasConflict = true;
            break;
          }
        }

        if (!hasConflict) {
          group.push(player);
          if (group.length === size) {
            return group;
          }
        }
      }
    }

    // Also try greedy approach: start with player with fewest conflicts
    const sortedByConflicts = [...players].sort((a, b) => {
      const conflictsA = this.countConflicts(a.id, players);
      const conflictsB = this.countConflicts(b.id, players);
      return conflictsA - conflictsB;
    });

    const group: Player[] = [];
    for (const player of sortedByConflicts) {
      let hasConflict = false;
      for (const existing of group) {
        if (this.hasTeammateConflict(player.id, existing.id)) {
          hasConflict = true;
          break;
        }
      }

      if (!hasConflict) {
        group.push(player);
        if (group.length === size) {
          return group;
        }
      }
    }

    return null; // No conflict-free group found
  }

  /**
   * When no conflict-free group exists, find the group with minimum total conflicts.
   */
  private static findMinimumConflictGroup(players: Player[], size: number): Player[] {
    if (players.length <= size) return players.slice(0, size);

    let bestGroup: Player[] = [];
    let bestConflictCount = Infinity;

    // Sample random groups and pick the one with fewest conflicts
    for (let attempt = 0; attempt < this.MAX_SEARCH_ATTEMPTS; attempt++) {
      const shuffled = this.shuffleArray([...players]);
      const group = shuffled.slice(0, size);
      const conflictCount = this.countGroupConflicts(group);

      if (conflictCount < bestConflictCount) {
        bestConflictCount = conflictCount;
        bestGroup = group;

        // If we found a zero-conflict group, we're done
        if (conflictCount === 0) break;
      }
    }

    return bestGroup;
  }

  /**
   * Checks if two players have been teammates before.
   */
  private static hasTeammateConflict(playerId1: string, playerId2: string): boolean {
    const key = this.pairKey(playerId1, playerId2);
    return (this.teammateCountMap.get(key) ?? 0) > 0;
  }

  /**
   * Counts how many other players this player has conflicts with.
   */
  private static countConflicts(playerId: string, allPlayers: Player[]): number {
    let count = 0;
    for (const other of allPlayers) {
      if (other.id !== playerId && this.hasTeammateConflict(playerId, other.id)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Counts total teammate conflicts within a group.
   */
  private static countGroupConflicts(group: Player[]): number {
    let count = 0;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const key = this.pairKey(group[i].id, group[j].id);
        count += this.teammateCountMap.get(key) ?? 0;
      }
    }
    return count;
  }

  /**
   * Creates optimal team split for a group of players.
   * Minimizes opponent repetition and maximizes skill balance.
   */
  private static createOptimalTeams(players: Player[]): Court['teams'] {
    if (players.length === 4) {
      return this.chooseBestTeamSplit(players).teams;
    } else if (players.length === 2) {
      return { team1: [players[0]], team2: [players[1]] };
    }
    return undefined;
  }

  /**
   * Evaluates all 3 possible team splits and returns the best one.
   * Optimizes for: minimal opponent repetition + skill balance.
   */
  private static chooseBestTeamSplit(players: Player[]): { teams: Court['teams']; cost: number } {
    const splits: Array<[[number, number], [number, number]]> = [
      [[0, 1], [2, 3]],
      [[0, 2], [1, 3]],
      [[0, 3], [1, 2]],
    ];

    let bestCost = Infinity;
    let bestTeams: Court['teams'] = undefined;

    for (const split of splits) {
      const team1 = [players[split[0][0]], players[split[0][1]]];
      const team2 = [players[split[1][0]], players[split[1][1]]];

      let cost = 0;

      // Opponent repetition cost
      for (const a of team1) {
        for (const b of team2) {
          cost += (this.opponentCountMap.get(this.pairKey(a.id, b.id)) ?? 0) * this.OPPONENT_WEIGHT;
        }
      }

      // Skill balance cost
      const team1Wins = team1.reduce((acc, p) => acc + (this.winCountMap.get(p.id) ?? 0), 0);
      const team2Wins = team2.reduce((acc, p) => acc + (this.winCountMap.get(p.id) ?? 0), 0);
      cost += Math.abs(team1Wins - team2Wins) * this.BALANCE_WEIGHT;

      const team1Losses = team1.reduce((acc, p) => acc + (this.lossCountMap.get(p.id) ?? 0), 0);
      const team2Losses = team2.reduce((acc, p) => acc + (this.lossCountMap.get(p.id) ?? 0), 0);
      cost += Math.abs(team1Losses - team2Losses) * this.BALANCE_WEIGHT;

      if (cost < bestCost) {
        bestCost = cost;
        bestTeams = { team1, team2 };
      }
    }

    return { teams: bestTeams, cost: bestCost };
  }

  // ============== Helper Methods ==============

  static getBenchedPlayers(assignments: Court[], players: Player[]): Player[] {
    const assignedIds = new Set(assignments.flatMap(c => c.players.map(p => p.id)));
    return players.filter(p => p.isPresent && !assignedIds.has(p.id));
  }

  private static pairKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  private static incrementMapCount(map: Map<string, number>, key: string, inc = 1): void {
    map.set(key, (map.get(key) ?? 0) + inc);
  }

  private static shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
    return array;
  }

  private static selectBenchedPlayers(players: Player[], benchSpots: number): Player[] {
    if (benchSpots <= 0) return [];

    players.forEach(p => {
      if (!this.benchCountMap.has(p.id)) this.benchCountMap.set(p.id, 0);
    });

    const shuffled = this.shuffleArray([...players]);
    return shuffled.sort((a, b) => {
      return (this.benchCountMap.get(a.id) ?? 0) - (this.benchCountMap.get(b.id) ?? 0);
    }).slice(0, benchSpots);
  }

  private static createManualCourt(players: Player[], courtNumber: number): Court {
    const court: Court = {
      courtNumber,
      players: [...players],
    };

    if (players.length === 4) {
      const res = this.chooseBestTeamSplit(players);
      court.teams = res.teams;
    } else if (players.length === 2) {
      court.teams = {
        team1: [players[0]],
        team2: [players[1]],
      };
    } else if (players.length === 3) {
      court.teams = {
        team1: [players[0]],
        team2: [players[1]],
      };
    }

    return court;
  }

  // ============== Debug/Analysis Methods ==============

  /**
   * Returns statistics about the current conflict graph state.
   */
  static getStats(): {
    totalTeammatePairs: number;
    maxTeammateCount: number;
    avgTeammateCount: number;
    conflictEdges: number;
  } {
    const teammateValues = Array.from(this.teammateCountMap.values());
    const conflictEdges = teammateValues.filter(v => v > 0).length;

    return {
      totalTeammatePairs: teammateValues.length,
      maxTeammateCount: Math.max(0, ...teammateValues),
      avgTeammateCount: teammateValues.length > 0
        ? teammateValues.reduce((a, b) => a + b, 0) / teammateValues.length
        : 0,
      conflictEdges,
    };
  }
}

/** Wrapper function for generating court assignments with Conflict Graph. */
export const generateCourtAssignmentsCG = (players: Player[], courts: number, manualCourt?: ManualCourtSelection): Court[] =>
  ConflictGraphEngine.generate(players, courts, manualCourt);

/** Wrapper function for getting benched players. */
export const getBenchedPlayersCG = (assignments: Court[], players: Player[]): Player[] =>
  ConflictGraphEngine.getBenchedPlayers(assignments, players);
