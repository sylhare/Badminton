import type { Court, ICourtAssignmentEngine, Player } from '../types';
import { pairKey } from '../utils/playerUtils';

import { BaseCourtAssignmentEngine } from './BaseCourtAssignmentEngine';

/**
 * Conflict Graph Implementation
 *
 * This engine uses a conflict graph to find a solution that guarantees
 * no teammate repetitions when possible.
 */
export class ConflictGraphEngine extends BaseCourtAssignmentEngine implements ICourtAssignmentEngine {
  private readonly MAX_SEARCH_ATTEMPTS = 100;
  private readonly OPPONENT_WEIGHT = 10;
  private readonly BALANCE_WEIGHT = 2;

  getName(): string {
    return 'Conflict Graph';
  }

  getDescription(): string {
    return 'Deterministic greedy construction using conflict graph modeling. Systematically builds assignments by selecting players that minimize total conflict.';
  }

  protected generateAssignments(players: Player[], numberOfCourts: number, startCourtNum: number): Court[] {
    return this.buildCourtsWithConflictGraph(players, numberOfCourts, startCourtNum);
  }

  protected getOptimalTeamSplit(players: Player[]): Court['teams'] {
    return this.chooseBestTeamSplit(players).teams;
  }

  protected evaluateTeamSplitCost(t1: Player[], t2: Player[]): number {
    let cost = 0;
    cost += this.calculateOpponentCost(t1, t2, this.OPPONENT_WEIGHT);
    cost += this.calculateWinBalanceCost(t1, t2, this.BALANCE_WEIGHT);
    cost += this.calculateLossBalanceCost(t1, t2, this.BALANCE_WEIGHT);
    return cost;
  }

  private buildCourtsWithConflictGraph(players: Player[], numberOfCourts: number, startCourtNum: number): Court[] {
    const courts: Court[] = [];
    const availablePlayers = [...players];
    for (let cNum = startCourtNum; cNum < startCourtNum + numberOfCourts; cNum++) {
      if (availablePlayers.length < 2) break;
      let cPlayers: Player[] | null = null;
      if (availablePlayers.length >= 4) {
        cPlayers = this.findConflictFreeGroup(availablePlayers, 4);
        if (!cPlayers) cPlayers = this.findMinimumConflictGroup(availablePlayers, 4);
      } else if (availablePlayers.length >= 2) cPlayers = this.selectBestSinglesPair(availablePlayers);
      if (!cPlayers || cPlayers.length < 2) break;
      for (const p of cPlayers) {
        const idx = availablePlayers.findIndex(ap => ap.id === p.id);
        if (idx !== -1) availablePlayers.splice(idx, 1);
      }
      const teams = this.createTeamsFromPlayers(cPlayers);
      courts.push({ courtNumber: cNum, players: cPlayers, teams });
    }
    return courts;
  }

  private findConflictFreeGroup(players: Player[], size: number): Player[] | null {
    for (let attempt = 0; attempt < this.MAX_SEARCH_ATTEMPTS; attempt++) {
      const shuffled = this.shuffleArray([...players]);
      const group: Player[] = [];
      for (const p of shuffled) {
        if (!group.some(e => this.hasTeammateConflict(p.id, e.id))) {
          group.push(p);
          if (group.length === size) return group;
        }
      }
    }
    const sorted = [...players].sort((a, b) => this.countConflicts(a.id, players) - this.countConflicts(b.id, players));
    const group: Player[] = [];
    for (const p of sorted) {
      if (!group.some(e => this.hasTeammateConflict(p.id, e.id))) {
        group.push(p);
        if (group.length === size) return group;
      }
    }
    return null;
  }

  private findMinimumConflictGroup(players: Player[], size: number): Player[] {
    if (players.length <= size) return players.slice(0, size);
    let bestGroup: Player[] = [];
    let bestCount = Infinity;
    for (let i = 0; i < this.MAX_SEARCH_ATTEMPTS; i++) {
      const group = this.shuffleArray([...players]).slice(0, size);
      const count = this.calculateTeammateCost(group, 1);
      if (count < bestCount) {
        bestCount = count;
        bestGroup = group;
        if (count === 0) break;
      }
    }
    return bestGroup;
  }

  private selectBestSinglesPair(players: Player[]): Player[] {
    return [...players].sort((a, b) =>
      (this.singleCountMap.get(a.id) ?? 0) - (this.singleCountMap.get(b.id) ?? 0),
    ).slice(0, 2);
  }

  private hasTeammateConflict(p1: string, p2: string): boolean {
    return (this.teammateCountMap.get(pairKey(p1, p2)) ?? 0) > 0;
  }

  private countConflicts(pid: string, all: Player[]): number {
    return all.reduce((acc, p) => acc + (p.id !== pid && this.hasTeammateConflict(pid, p.id) ? 1 : 0), 0);
  }
}

export const engineCG = new ConflictGraphEngine();
