import type { Court, Player, ManualCourtSelection, CourtEngineState, ICourtAssignmentEngine } from '../types';

import { saveCourtEngineState, loadCourtEngineState } from '../utils/storageUtils';

/**
 * CourtAssignmentEngine - Badminton Court Assignment and Player Management System
 *
 * @pattern Monte Carlo Greedy Search
 *
 * @description
 * This class implements a court assignment algorithm using a Monte Carlo approach combined
 * with greedy cost evaluation. The algorithm generates fair and balanced badminton court
 * assignments while considering historical data to maximize variety and fairness.
 *
 */
export class CourtAssignmentEngine implements ICourtAssignmentEngine {
  /** Tracks how many times each player has been benched across all sessions */
  private benchCountMap: Map<string, number> = new Map();
  /** Tracks how many times each player has played singles matches across all sessions */
  private singleCountMap: Map<string, number> = new Map();
  /** Tracks pairwise teammate frequency to encourage variety */
  private teammateCountMap: Map<string, number> = new Map();
  /** Tracks pairwise opponent frequency to encourage variety */
  private opponentCountMap: Map<string, number> = new Map();
  /** Tracks total wins per player for skill-based team balancing */
  private winCountMap: Map<string, number> = new Map();
  /** Tracks total losses per player for skill-based team balancing */
  private lossCountMap: Map<string, number> = new Map();
  /** Tracks recorded match outcomes for the current session (court number → match result) */
  private recordedWinsMap: Map<number, { winner: 1 | 2; winningPlayers: string[]; losingPlayers: string[] }> = new Map();
  /** Cache for memoizing cost evaluations during generate() to avoid redundant calculations */
  private costCache: Map<string, number> = new Map();
  /** Maximum number of random configurations to try (Monte Carlo iterations) */
  private readonly MAX_ATTEMPTS = 300;
  /** Observer pattern listeners for state change notifications */
  private stateChangeListeners: Array<() => void> = [];

  /**
   * Subscribes to state changes in the engine (Observer pattern).
   */
  onStateChange(listener: () => void): () => void {
    this.stateChangeListeners.push(listener);
    return () => {
      const index = this.stateChangeListeners.indexOf(listener);
      if (index > -1) {
        this.stateChangeListeners.splice(index, 1);
      }
    };
  }

  /** Notifies all subscribed listeners of a state change. */
  private notifyStateChange(): void {
    this.stateChangeListeners.forEach(listener => listener());
  }

  resetHistory(): void {
    this.benchCountMap.clear();
    this.singleCountMap.clear();
    this.teammateCountMap.clear();
    this.opponentCountMap.clear();
    this.winCountMap.clear();
    this.lossCountMap.clear();
    this.recordedWinsMap.clear();
    this.notifyStateChange();
  }

  /** Clears only the current session's recorded match outcomes. */
  clearCurrentSession(): void {
    this.recordedWinsMap.clear();
  }

  prepareStateForSaving(): CourtEngineState {
    return {
      benchCountMap: Object.fromEntries(this.benchCountMap),
      singleCountMap: Object.fromEntries(this.singleCountMap),
      teammateCountMap: Object.fromEntries(this.teammateCountMap),
      opponentCountMap: Object.fromEntries(this.opponentCountMap),
      winCountMap: Object.fromEntries(this.winCountMap),
      lossCountMap: Object.fromEntries(this.lossCountMap),
    };
  }

  saveState(): void {
    saveCourtEngineState(this.prepareStateForSaving());
  }

  loadState(): void {
    const state = loadCourtEngineState();

    if (state.benchCountMap) {
      this.benchCountMap = new Map(Object.entries(state.benchCountMap));
    }
    if (state.singleCountMap) {
      this.singleCountMap = new Map(Object.entries(state.singleCountMap));
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

  private shouldReversePreviousRecord(previousRecord: { winner: 1 | 2; winningPlayers: string[]; losingPlayers: string[] }, currentWinner: 1 | 2, currentWinningPlayerIds: string[]): boolean {
    return !(previousRecord.winner === currentWinner &&
      JSON.stringify(previousRecord.winningPlayers.sort()) === JSON.stringify(currentWinningPlayerIds.sort()));
  }

  private reversePreviousWinRecord(previousRecord: { winner: 1 | 2; winningPlayers: string[]; losingPlayers: string[] }): void {
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

  reverseWinForCourt(courtNumber: number): void {
    const previousRecord = this.recordedWinsMap.get(courtNumber);
    if (previousRecord) {
      this.reversePreviousWinRecord(previousRecord);
      this.recordedWinsMap.delete(courtNumber);
      this.notifyStateChange();
    }
  }

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

  recordWins(courts: Court[]): void {
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

  getWinCounts(): Map<string, number> {
    return new Map(this.winCountMap);
  }

  getBenchCounts(): Map<string, number> {
    return new Map(this.benchCountMap);
  }

  generate(players: Player[], numberOfCourts: number, manualSelection?: ManualCourtSelection, forceBenchPlayerIds?: Set<string>): Court[] {
    const presentPlayers = players.filter(p => p.isPresent);
    if (presentPlayers.length === 0) return [];

    this.costCache.clear();

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

    const forceBenchedPlayers = forceBenchPlayerIds
      ? remainingPlayers.filter(p => forceBenchPlayerIds.has(p.id))
      : [];

    const additionalBenchSpots = Math.max(0, benchSpots - forceBenchedPlayers.length);
    const playersForAlgorithmBench = remainingPlayers.filter(p => !forceBenchPlayerIds?.has(p.id));
    const algorithmBenchedPlayers = this.selectBenchedPlayers(playersForAlgorithmBench, additionalBenchSpots);

    const benchedPlayers = [...forceBenchedPlayers, ...algorithmBenchedPlayers];
    const onCourtPlayers = remainingPlayers.filter(p => !benchedPlayers.includes(p));

    let best: { courts: Court[]; cost: number } | null = null;
    for (let i = 0; i < this.MAX_ATTEMPTS; i++) {
      const cand = this.generateCandidate(onCourtPlayers, remainingCourts, manualCourtResult ? 2 : 1);
      if (!best || cand.cost < best.cost) best = cand;
    }

    let finalCourts = best ? best.courts : [];

    if (manualCourtResult) {
      finalCourts = [manualCourtResult, ...finalCourts];
    }

    benchedPlayers.forEach(p => this.incrementMapCount(this.benchCountMap, p.id));
    finalCourts.forEach(court => {
      if (!court.teams) return;

      if (court.players.length === 2) {
        court.players.forEach(p => this.incrementMapCount(this.singleCountMap, p.id));
      }

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

  getBenchedPlayers(assignments: Court[], players: Player[]): Player[] {
    const assignedIds = new Set(assignments.flatMap(c => c.players.map(p => p.id)));
    return players.filter(p => p.isPresent && !assignedIds.has(p.id));
  }

  private pairKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  private getCourtCacheKey(court: Court): string {
    if (!court.teams) return '';

    const allPlayerIds = [
      ...court.teams.team1.map(p => p.id),
      ...court.teams.team2.map(p => p.id),
    ].sort();

    return allPlayerIds.join('|');
  }

  private incrementMapCount(map: Map<string, number>, key: string, inc = 1): void {
    map.set(key, (map.get(key) ?? 0) + inc);
  }

  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
    return array;
  }

  private selectBenchedPlayers(players: Player[], benchSpots: number): Player[] {
    if (benchSpots <= 0) return [];

    players.forEach(p => {
      if (!this.benchCountMap.has(p.id)) this.benchCountMap.set(p.id, 0);
    });

    const shuffled = this.shuffleArray([...players]);
    return shuffled.sort((a, b) => {
      return (this.benchCountMap.get(a.id) ?? 0) - (this.benchCountMap.get(b.id) ?? 0);
    }).slice(0, benchSpots);
  }

  private evaluateCourtCost(court: Court): number {
    const cacheKey = this.getCourtCacheKey(court);

    if (cacheKey && this.costCache.has(cacheKey)) {
      return this.costCache.get(cacheKey)!;
    }

    let cost = 0;

    if (court.players.length === 2 && court.teams) {
      const player1SinglesCount = this.singleCountMap.get(court.players[0].id) ?? 0;
      const player2SinglesCount = this.singleCountMap.get(court.players[1].id) ?? 0;
      cost += (player1SinglesCount + player2SinglesCount) * 100;
    }

    if (court.teams) {
      const addTeamPairs = (team: Player[]): void => {
        for (let i = 0; i < team.length; i++) {
          for (let j = i + 1; j < team.length; j++) {
            cost += this.teammateCountMap.get(this.pairKey(team[i].id, team[j].id)) ?? 0;
          }
        }
      };

      addTeamPairs(court.teams.team1);
      addTeamPairs(court.teams.team2);

      court.teams.team1.forEach(a => {
        court.teams!.team2.forEach(b => {
          cost += this.opponentCountMap.get(this.pairKey(a.id, b.id)) ?? 0;
        });
      });

      const addSkillPairPenalty = (team: Player[]): void => {
        for (let i = 0; i < team.length; i++) {
          for (let j = i + 1; j < team.length; j++) {
            const p1 = team[i];
            const p2 = team[j];
            const wins1 = this.winCountMap.get(p1.id) ?? 0;
            const wins2 = this.winCountMap.get(p2.id) ?? 0;
            const losses1 = this.lossCountMap.get(p1.id) ?? 0;
            const losses2 = this.lossCountMap.get(p2.id) ?? 0;

            cost += wins1 * wins2;
            cost += losses1 * losses2;
          }
        }
      };

      addSkillPairPenalty(court.teams.team1);
      addSkillPairPenalty(court.teams.team2);

      const team1WinSum = court.teams.team1.reduce((acc, p) => acc + (this.winCountMap.get(p.id) ?? 0), 0);
      const team2WinSum = court.teams.team2.reduce((acc, p) => acc + (this.winCountMap.get(p.id) ?? 0), 0);
      cost += Math.abs(team1WinSum - team2WinSum);

      const team1LossSum = court.teams.team1.reduce((acc, p) => acc + (this.lossCountMap.get(p.id) ?? 0), 0);
      const team2LossSum = court.teams.team2.reduce((acc, p) => acc + (this.lossCountMap.get(p.id) ?? 0), 0);
      cost += Math.abs(team1LossSum - team2LossSum);
    }

    if (cacheKey) {
      this.costCache.set(cacheKey, cost);
    }

    return cost;
  }

  private chooseBestTeamSplit(players: Player[]): { teams: Court['teams']; cost: number } {
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
      const cost = this.evaluateCourtCost({ courtNumber: -1, players, teams: { team1, team2 } });
      if (cost < bestCost) {
        bestCost = cost;
        bestTeams = { team1, team2 };
      }
    });

    return { teams: bestTeams, cost: bestCost };
  }

  private createManualCourt(players: Player[], courtNumber: number): Court {
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

  private generateCandidate(onCourtPlayers: Player[], numberOfCourts: number, startCourtNum: number = 1) {
    const courts: Court[] = [];
    const playersCopy = this.shuffleArray([...onCourtPlayers]);

    const playersPerCourt = 4;
    let idx = 0;
    let totalCost = 0;

    for (let courtNum = startCourtNum; courtNum < startCourtNum + numberOfCourts; courtNum++) {
      const courtPlayers: Player[] = [];
      for (let i = 0; i < playersPerCourt && idx < playersCopy.length; i++) {
        courtPlayers.push(playersCopy[idx++]);
      }

      if (courtPlayers.length < 2) break;
      if (courtPlayers.length === 3) {
        playersCopy.unshift(courtPlayers.pop()!);
      }

      let teams: Court['teams'] | undefined;
      let cost = 0;

      if (courtPlayers.length === 4) {
        const res = this.chooseBestTeamSplit(courtPlayers);
        teams = res.teams;
        cost = res.cost;
      } else {
        teams = { team1: [courtPlayers[0]], team2: [courtPlayers[1]] };
        cost = this.evaluateCourtCost({ courtNumber: -1, players: courtPlayers, teams });
      }

      totalCost += cost;
      courts.push({ courtNumber: courtNum, players: courtPlayers, teams });
    }

    return { courts, cost: totalCost };
  }
}

/** Singleton instance of the Monte Carlo engine. */
export const engineMC = new CourtAssignmentEngine();