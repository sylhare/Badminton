import type { Court, Player, ManualCourtSelection, CourtEngineState } from '../types';

import { saveCourtEngineState, loadCourtEngineState } from './storageUtils';

/**
 * CourtAssignmentEngineSA - Simulated Annealing Court Assignment Engine
 *
 * @pattern Simulated Annealing with Hard Constraints
 *
 * @description
 * This class implements a court assignment algorithm using Simulated Annealing (SA),
 * designed to provide stronger guarantees against teammate/opponent repetition than
 * the Monte Carlo approach. SA can escape local minima and explore the solution space
 * more effectively.
 *
 * ## Key Differences from Monte Carlo:
 * - **Iterative Improvement**: Builds on previous solutions rather than independent samples
 * - **Accepts Worse Solutions**: Probabilistically accepts worse solutions to escape local minima
 * - **Temperature Schedule**: Gradually reduces acceptance probability of worse solutions
 * - **Hard Constraints**: Uses very high penalties for repetitions, effectively making them forbidden
 *
 * ## Algorithm Overview:
 * 1. Generate an initial random assignment
 * 2. Iteratively perturb the solution (swap players between courts/teams)
 * 3. Accept improvements always; accept worse solutions with probability e^(-Δ/T)
 * 4. Gradually reduce temperature T (cooling schedule)
 * 5. Return best solution found
 *
 * ## Cost Function:
 * - **Hard Penalty**: Repeated teammates get massive penalty (effectively forbidden)
 * - **Soft Penalties**: Opponent repetition, skill balance, skill pairing
 *
 * ## Performance:
 * - Iterations: 1500 max (with early termination on perfect solution)
 * - Perturbations per iteration: 1 (single swap)
 * - Time complexity: O(iterations × perturbation_cost) ≈ O(1500 × n)
 * - Early termination when cost = 0 (no teammate repeats) for ~3x speedup
 */
export class CourtAssignmentEngineSA {
  /** Tracks how many times each player has been benched across all sessions */
  private static benchCountMap: Map<string, number> = new Map();
  /** Tracks which players were benched in the previous round (to prevent double benches) */
  private static lastRoundBenchedSet: Set<string> = new Set();
  /** Tracks pairwise teammate frequency to encourage variety */
  private static teammateCountMap: Map<string, number> = new Map();
  /** Tracks pairwise opponent frequency to encourage variety */
  private static opponentCountMap: Map<string, number> = new Map();
  /** Tracks total wins per player for skill-based team balancing */
  private static winCountMap: Map<string, number> = new Map();
  /** Tracks total losses per player for skill-based team balancing */
  private static lossCountMap: Map<string, number> = new Map();
  /** Tracks recorded match outcomes for the current session */
  private static recordedWinsMap: Map<number, { winner: 1 | 2; winningPlayers: string[]; losingPlayers: string[] }> = new Map();
  /** Observer pattern listeners for state change notifications */
  private static stateChangeListeners: Array<() => void> = [];

  /** Number of SA iterations (reduced from 5000 for speed) */
  private static readonly SA_ITERATIONS = 1500;
  /** Initial temperature (higher = more exploration) */
  private static readonly INITIAL_TEMPERATURE = 100.0;
  /** Cooling rate (faster cooling for quicker convergence) */
  private static readonly COOLING_RATE = 0.995;
  /** Minimum temperature (stop accepting worse solutions below this) */
  private static readonly MIN_TEMPERATURE = 0.1;

  /** Penalty for repeated teammates (very high = hard constraint) */
  private static readonly TEAMMATE_REPEAT_PENALTY = 10000;
  /** Penalty multiplier for opponent repetition */
  private static readonly OPPONENT_REPEAT_PENALTY = 50;
  /** Penalty for skill pairing (high-win with high-win) */
  private static readonly SKILL_PAIR_PENALTY = 1;
  /** Penalty for team imbalance */
  private static readonly BALANCE_PENALTY = 2;

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
    this.lastRoundBenchedSet.clear();
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

  /**
   * Generates optimal court assignments using Simulated Annealing.
   *
   * @param players - Array of all players (present and absent)
   * @param numberOfCourts - Number of courts available
   * @param manualSelection - Optional manual court selection for specific players
   * @returns Array of court assignments with teams and players
   */
  static generate(players: Player[], numberOfCourts: number, manualSelection?: ManualCourtSelection): Court[] {
    const presentPlayers = players.filter(p => p.isPresent);
    if (presentPlayers.length === 0) return [];

    let manualCourtResult: Court | null = null;
    let remainingPlayers = presentPlayers;
    let remainingCourts = numberOfCourts;

    if (manualSelection && manualSelection.players.length > 0) {
      const manualPlayers = manualSelection.players.filter(p => p.isPresent);
      if (manualPlayers.length >= 2 && manualPlayers.length <= 4) {
        manualCourtResult = this.createManualCourt(manualPlayers, 1);
        remainingPlayers = presentPlayers.filter(p => !manualPlayers.some(mp => mp.id === p.id));
        remainingCourts = numberOfCourts - 1;
      }
    }

    const capacity = remainingCourts * 4;
    let benchSpots = Math.max(0, remainingPlayers.length - capacity);
    if ((remainingPlayers.length - benchSpots) % 2 === 1) benchSpots += 1;
    benchSpots = Math.min(benchSpots, remainingPlayers.length);

    const benchedPlayers = this.selectBenchedPlayers(remainingPlayers, benchSpots);
    const onCourtPlayers = remainingPlayers.filter(p => !benchedPlayers.includes(p));

    const startCourtNum = manualCourtResult ? 2 : 1;
    const saCourts = this.runSimulatedAnnealing(onCourtPlayers, remainingCourts, startCourtNum);

    let finalCourts = saCourts;

    if (manualCourtResult) {
      finalCourts = [manualCourtResult, ...finalCourts];
    }

    this.lastRoundBenchedSet.clear();
    benchedPlayers.forEach(p => {
      this.incrementMapCount(this.benchCountMap, p.id);
      this.lastRoundBenchedSet.add(p.id);
    });
    
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
   * Core Simulated Annealing algorithm.
   */
  private static runSimulatedAnnealing(players: Player[], numberOfCourts: number, startCourtNum: number): Court[] {
    if (players.length < 2) return [];

    let current = this.generateInitialSolution(players, numberOfCourts, startCourtNum);
    let currentCost = this.evaluateTotalCost(current);
    let best = this.cloneCourts(current);
    let bestCost = currentCost;

    if (bestCost === 0) return best;

    let temperature = this.INITIAL_TEMPERATURE;

    for (let i = 0; i < this.SA_ITERATIONS; i++) {

      const neighbor = this.perturbSolution(current);
      const neighborCost = this.evaluateTotalCost(neighbor);

      const delta = neighborCost - currentCost;

      if (delta < 0 || (temperature > this.MIN_TEMPERATURE && Math.random() < Math.exp(-delta / temperature))) {
        current = neighbor;
        currentCost = neighborCost;

        if (currentCost < bestCost) {
          best = this.cloneCourts(current);
          bestCost = currentCost;

          if (bestCost === 0) return best;
        }
      }

      temperature *= this.COOLING_RATE;
    }

    return best;
  }

  /**
   * Generates an initial random solution for SA to improve upon.
   */
  private static generateInitialSolution(players: Player[], numberOfCourts: number, startCourtNum: number): Court[] {
    const courts: Court[] = [];
    const shuffled = this.shuffleArray([...players]);

    let idx = 0;
    for (let courtNum = startCourtNum; courtNum < startCourtNum + numberOfCourts; courtNum++) {
      const courtPlayers: Player[] = [];
      for (let i = 0; i < 4 && idx < shuffled.length; i++) {
        courtPlayers.push(shuffled[idx++]);
      }

      if (courtPlayers.length < 2) break;
      if (courtPlayers.length === 3) {

        shuffled.unshift(courtPlayers.pop()!);
        idx--;
      }

      const teams = this.createTeams(courtPlayers);
      courts.push({ courtNumber: courtNum, players: courtPlayers, teams });
    }

    return courts;
  }

  /**
   * Creates teams for a court, trying all 3 splits and picking the best.
   */
  private static createTeams(players: Player[]): Court['teams'] {
    if (players.length === 4) {
      return this.chooseBestTeamSplit(players).teams;
    } else if (players.length === 2) {
      return { team1: [players[0]], team2: [players[1]] };
    }
    return undefined;
  }

  /**
   * Perturbs the current solution by making a small random change.
   *
   * Perturbation strategies:
   * 1. Swap two players between different courts
   * 2. Swap two players within same court (changes teams)
   * 3. Re-split teams on a single court
   */
  private static perturbSolution(courts: Court[]): Court[] {
    const newCourts = this.cloneCourts(courts);

    if (newCourts.length === 0) return newCourts;

    const strategy = Math.random();

    if (strategy < 0.5 && newCourts.length > 1) {

      this.swapPlayersBetweenCourts(newCourts);
    } else if (strategy < 0.8) {

      this.resplitCourtTeams(newCourts);
    } else {

      this.swapWithinCourt(newCourts);
    }

    return newCourts;
  }

  /**
   * Swaps one player from court A with one player from court B.
   */
  private static swapPlayersBetweenCourts(courts: Court[]): void {
    if (courts.length < 2) return;

    const courtA = Math.floor(Math.random() * courts.length);
    let courtB = Math.floor(Math.random() * courts.length);
    while (courtB === courtA) {
      courtB = Math.floor(Math.random() * courts.length);
    }

    const playersA = courts[courtA].players;
    const playersB = courts[courtB].players;

    if (playersA.length === 0 || playersB.length === 0) return;

    const idxA = Math.floor(Math.random() * playersA.length);
    const idxB = Math.floor(Math.random() * playersB.length);

    const temp = playersA[idxA];
    playersA[idxA] = playersB[idxB];
    playersB[idxB] = temp;

    courts[courtA].teams = this.createTeams(playersA);
    courts[courtB].teams = this.createTeams(playersB);
  }

  /**
   * Re-randomizes and re-splits teams on a single court.
   */
  private static resplitCourtTeams(courts: Court[]): void {
    const courtIdx = Math.floor(Math.random() * courts.length);
    const court = courts[courtIdx];

    if (court.players.length === 4) {

      this.shuffleArray(court.players);
      court.teams = this.chooseBestTeamSplit(court.players).teams;
    }
  }

  /**
   * Swaps two players within the same court (changes team composition).
   */
  private static swapWithinCourt(courts: Court[]): void {
    const courtIdx = Math.floor(Math.random() * courts.length);
    const court = courts[courtIdx];

    if (!court.teams || court.players.length !== 4) return;

    const idx1 = Math.floor(Math.random() * court.teams.team1.length);
    const idx2 = Math.floor(Math.random() * court.teams.team2.length);

    const temp = court.teams.team1[idx1];
    court.teams.team1[idx1] = court.teams.team2[idx2];
    court.teams.team2[idx2] = temp;

    court.players = [...court.teams.team1, ...court.teams.team2];
  }

  /**
   * Deep clones court array for SA iteration.
   */
  private static cloneCourts(courts: Court[]): Court[] {
    return courts.map(court => ({
      courtNumber: court.courtNumber,
      players: [...court.players],
      teams: court.teams ? {
        team1: [...court.teams.team1],
        team2: [...court.teams.team2],
      } : undefined,
      winner: court.winner,
    }));
  }

  /**
   * Evaluates total cost of an assignment.
   * Uses HARD penalties for teammate repetition.
   */
  private static evaluateTotalCost(courts: Court[]): number {
    let totalCost = 0;

    for (const court of courts) {
      if (!court.teams) continue;

      const addTeammateCost = (team: Player[]): void => {
        for (let i = 0; i < team.length; i++) {
          for (let j = i + 1; j < team.length; j++) {
            const count = this.teammateCountMap.get(this.pairKey(team[i].id, team[j].id)) ?? 0;
            if (count > 0) {

              totalCost += this.TEAMMATE_REPEAT_PENALTY * count;
            }
          }
        }
      };

      addTeammateCost(court.teams.team1);
      addTeammateCost(court.teams.team2);

      court.teams.team1.forEach(a => {
        court.teams!.team2.forEach(b => {
          const count = this.opponentCountMap.get(this.pairKey(a.id, b.id)) ?? 0;
          totalCost += this.OPPONENT_REPEAT_PENALTY * count;
        });
      });

      const addSkillPairPenalty = (team: Player[]): void => {
        for (let i = 0; i < team.length; i++) {
          for (let j = i + 1; j < team.length; j++) {
            const wins1 = this.winCountMap.get(team[i].id) ?? 0;
            const wins2 = this.winCountMap.get(team[j].id) ?? 0;
            const losses1 = this.lossCountMap.get(team[i].id) ?? 0;
            const losses2 = this.lossCountMap.get(team[j].id) ?? 0;

            totalCost += this.SKILL_PAIR_PENALTY * (wins1 * wins2 + losses1 * losses2);
          }
        }
      };

      addSkillPairPenalty(court.teams.team1);
      addSkillPairPenalty(court.teams.team2);

      const team1WinSum = court.teams.team1.reduce((acc, p) => acc + (this.winCountMap.get(p.id) ?? 0), 0);
      const team2WinSum = court.teams.team2.reduce((acc, p) => acc + (this.winCountMap.get(p.id) ?? 0), 0);
      totalCost += this.BALANCE_PENALTY * Math.abs(team1WinSum - team2WinSum);

      const team1LossSum = court.teams.team1.reduce((acc, p) => acc + (this.lossCountMap.get(p.id) ?? 0), 0);
      const team2LossSum = court.teams.team2.reduce((acc, p) => acc + (this.lossCountMap.get(p.id) ?? 0), 0);
      totalCost += this.BALANCE_PENALTY * Math.abs(team1LossSum - team2LossSum);
    }

    return totalCost;
  }

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

  /**
   * Selects players to be benched based on historical bench counts.
   * 
   * CRITICAL: Players who were benched in the previous round are strongly avoided
   * to prevent "double benches" (sitting out consecutive rounds). This takes 
   * priority over all other considerations including teammate repeat avoidance.
   */
  private static selectBenchedPlayers(players: Player[], benchSpots: number): Player[] {
    if (benchSpots <= 0) return [];

    players.forEach(p => {
      if (!this.benchCountMap.has(p.id)) this.benchCountMap.set(p.id, 0);
    });

    const shuffled = this.shuffleArray([...players]);

    return shuffled.sort((a, b) => {
      const aWasBenchedLastRound = this.lastRoundBenchedSet.has(a.id) ? 1 : 0;
      const bWasBenchedLastRound = this.lastRoundBenchedSet.has(b.id) ? 1 : 0;

      if (aWasBenchedLastRound !== bWasBenchedLastRound) {
        return aWasBenchedLastRound - bWasBenchedLastRound;
      }

      return (this.benchCountMap.get(a.id) ?? 0) - (this.benchCountMap.get(b.id) ?? 0);
    }).slice(0, benchSpots);
  }

  private static chooseBestTeamSplit(players: Player[]): { teams: Court['teams']; cost: number } {
    const splits: Array<[[number, number], [number, number]]> = [
      [[0, 1], [2, 3]],
      [[0, 2], [1, 3]],
      [[0, 3], [1, 2]],
    ];

    let bestCost = Infinity;
    let bestTeams: Court['teams'] = undefined;

    splits.forEach(split => {
      const team1 = [players[split[0][0]], players[split[0][1]]];
      const team2 = [players[split[1][0]], players[split[1][1]]];
      const cost = this.evaluateSplitCost(team1, team2);
      if (cost < bestCost) {
        bestCost = cost;
        bestTeams = { team1, team2 };
      }
    });

    return { teams: bestTeams, cost: bestCost };
  }

  /**
   * Evaluates cost of a specific team split (used during team selection).
   */
  private static evaluateSplitCost(team1: Player[], team2: Player[]): number {
    let cost = 0;

    const addTeammateCost = (team: Player[]): void => {
      for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) {
          cost += (this.teammateCountMap.get(this.pairKey(team[i].id, team[j].id)) ?? 0) * this.TEAMMATE_REPEAT_PENALTY;
        }
      }
    };
    addTeammateCost(team1);
    addTeammateCost(team2);

    team1.forEach(a => {
      team2.forEach(b => {
        cost += (this.opponentCountMap.get(this.pairKey(a.id, b.id)) ?? 0) * this.OPPONENT_REPEAT_PENALTY;
      });
    });

    const team1Wins = team1.reduce((acc, p) => acc + (this.winCountMap.get(p.id) ?? 0), 0);
    const team2Wins = team2.reduce((acc, p) => acc + (this.winCountMap.get(p.id) ?? 0), 0);
    cost += Math.abs(team1Wins - team2Wins) * this.BALANCE_PENALTY;

    return cost;
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

  /**
   * Returns statistics about the current state (useful for analysis).
   */
  static getStats(): {
    totalTeammatePairs: number;
    maxTeammateCount: number;
    avgTeammateCount: number;
    totalOpponentPairs: number;
    maxOpponentCount: number;
  } {
    const teammateValues = Array.from(this.teammateCountMap.values());
    const opponentValues = Array.from(this.opponentCountMap.values());

    return {
      totalTeammatePairs: teammateValues.length,
      maxTeammateCount: Math.max(0, ...teammateValues),
      avgTeammateCount: teammateValues.length > 0
        ? teammateValues.reduce((a, b) => a + b, 0) / teammateValues.length
        : 0,
      totalOpponentPairs: opponentValues.length,
      maxOpponentCount: Math.max(0, ...opponentValues),
    };
  }
}

/** Wrapper function for generating court assignments with SA. */
export const generateCourtAssignmentsSA = (players: Player[], courts: number, manualCourt?: ManualCourtSelection): Court[] =>
  CourtAssignmentEngineSA.generate(players, courts, manualCourt);

/** Wrapper function for getting benched players. */
export const getBenchedPlayersSA = (assignments: Court[], players: Player[]): Player[] =>
  CourtAssignmentEngineSA.getBenchedPlayers(assignments, players);
