import type { Court, ICourtAssignmentEngine, Player } from '../types';

import { BaseCourtAssignmentEngine } from './BaseCourtAssignmentEngine';

/**
 * Monte Carlo Greedy Search Implementation
 *
 * This engine generates multiple random configurations and selects the one
 * with the lowest heuristic cost.
 */
export class MonteCarloEngine extends BaseCourtAssignmentEngine implements ICourtAssignmentEngine {
  private costCache: Map<string, number> = new Map();
  private readonly MAX_ATTEMPTS = 300;

  getName(): string {
    return 'Monte Carlo';
  }

  getDescription(): string {
    return 'Monte Carlo sampling with greedy evaluation. Generates 300 random candidate assignments and selects the one with lowest cost.';
  }

  protected generateAssignments(players: Player[], numberOfCourts: number, startCourtNum: number): Court[] {
    this.costCache.clear();

    let best: { courts: Court[]; cost: number } | null = null;
    for (let i = 0; i < this.MAX_ATTEMPTS; i++) {
      const cand = this.generateCandidate(players, numberOfCourts, startCourtNum);
      if (!best || cand.cost < best.cost) best = cand;
    }

    return best ? best.courts : [];
  }

  protected getOptimalTeamSplit(players: Player[]): Court['teams'] {
    return this.chooseBestTeamSplit(players).teams;
  }

  protected evaluateTeamSplitCost(team1: Player[], team2: Player[]): number {
    let cost = 0;

    cost += this.calculateTeammateCost(team1, 1);
    cost += this.calculateTeammateCost(team2, 1);
    cost += this.calculateOpponentCost(team1, team2, 1);
    cost += this.calculateSkillPairPenalty(team1, 1);
    cost += this.calculateSkillPairPenalty(team2, 1);
    cost += this.calculateWinBalanceCost(team1, team2, 1);
    cost += this.calculateLossBalanceCost(team1, team2, 1);

    return cost;
  }

  private evaluateCourtCost(court: Court): number {
    if (!court.teams) return 0;
    const cacheKey = this.getCourtCacheKey(court);
    if (cacheKey && this.costCache.has(cacheKey)) return this.costCache.get(cacheKey)!;

    let cost = 0;

    if (court.players.length === 2) {
      cost += this.calculateSinglesCost(court.players, 100);
    }

    cost += this.calculateTeammateCost(court.teams.team1, 1);
    cost += this.calculateTeammateCost(court.teams.team2, 1);
    cost += this.calculateOpponentCost(court.teams.team1, court.teams.team2, 1);
    cost += this.calculateSkillPairPenalty(court.teams.team1, 1);
    cost += this.calculateSkillPairPenalty(court.teams.team2, 1);

    const winCost = this.calculateWinBalanceCost(court.teams.team1, court.teams.team2, 1);
    if (winCost > 0) {
      const team1WinSum = court.teams.team1.reduce((acc, p) => acc + (this.winCountMap.get(p.id) ?? 0), 0);
      const team2WinSum = court.teams.team2.reduce((acc, p) => acc + (this.winCountMap.get(p.id) ?? 0), 0);
      console.log(`[ENGINE DEBUG] T1 Wins: ${team1WinSum}, T2 Wins: ${team2WinSum}, Diff: ${winCost}`);
    }
    cost += winCost;
    cost += this.calculateLossBalanceCost(court.teams.team1, court.teams.team2, 1);

    if (cacheKey) this.costCache.set(cacheKey, cost);
    return cost;
  }

  private getCourtCacheKey(court: Court): string {
    if (!court.teams) return '';
    const t1 = court.teams.team1.map(p => p.id).sort().join(',');
    const t2 = court.teams.team2.map(p => p.id).sort().join(',');
    return [t1, t2].sort().join('||');
  }

  private generateCandidate(onCourtPlayers: Player[], numberOfCourts: number, startCourtNum: number) {
    const courts: Court[] = [];
    const playersCopy = this.shuffleArray([...onCourtPlayers]);
    let idx = 0;
    let totalCost = 0;

    for (let courtNum = startCourtNum; courtNum < startCourtNum + numberOfCourts; courtNum++) {
      const courtPlayers: Player[] = playersCopy.slice(idx, idx + 4);
      idx += 4;
      if (courtPlayers.length < 2) break;
      if (courtPlayers.length === 3) {
        idx--;
        playersCopy.unshift(courtPlayers.pop()!);
      }

      let teams: Court['teams'];
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

export const engineMC = new MonteCarloEngine();