import type { Court, Player, ManualCourtSelection, ICourtAssignmentEngine } from '../types';
import { CourtAssignmentTracker } from './CourtAssignmentTracker';

/**
 * Conflict Graph Implementation
 * 
 * This engine uses a conflict graph to find a solution that guarantees
 * no teammate repetitions when possible.
 */
export class ConflictGraphEngine extends CourtAssignmentTracker implements ICourtAssignmentEngine {
  private readonly MAX_SEARCH_ATTEMPTS = 100;
  private readonly OPPONENT_WEIGHT = 10;
  private readonly BALANCE_WEIGHT = 2;

  generate(players: Player[], numberOfCourts: number, manualSelection?: ManualCourtSelection, forceBenchPlayerIds?: Set<string>): Court[] {
    const presentPlayers = players.filter(p => p.isPresent);
    if (presentPlayers.length === 0) return [];

    let manualCourtResult: Court | null = null;
    let remainingPlayers = presentPlayers;
    let remainingCourts = numberOfCourts;

    if (manualSelection && manualSelection.players.length > 0) {
      const manualPlayers = manualSelection.players.filter(p => p.isPresent);
      if (manualPlayers.length >= 2 && manualPlayers.length <= 4) {
        manualCourtResult = this.createManualCourt(manualPlayers, 1, (p) => this.chooseBestTeamSplit(p).teams);
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

    const startCourtNum = manualCourtResult ? 2 : 1;
    const courts = this.buildCourtsWithConflictGraph(onCourtPlayers, remainingCourts, startCourtNum);

    let finalCourts = courts;
    if (manualCourtResult) finalCourts = [manualCourtResult, ...finalCourts];

    benchedPlayers.forEach(p => this.recordBenching(p.id));
    finalCourts.forEach(court => {
      if (!court.teams) return;
      if (court.players.length === 2) court.players.forEach(p => this.recordSingles(p.id));
      const addTeamPairs = (team: Player[]) => {
        for (let i = 0; i < team.length; i++) {
          for (let j = i + 1; j < team.length; j++) this.recordTeammatePair(team[i].id, team[j].id);
        }
      };
      addTeamPairs(court.teams.team1);
      addTeamPairs(court.teams.team2);
      court.teams.team1.forEach(a => court.teams!.team2.forEach(b => this.recordOpponentPair(a.id, b.id)));
    });

    return finalCourts;
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
      const teams = this.createOptimalTeams(cPlayers);
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
      const count = this.countGroupConflicts(group);
      if (count < bestCount) { bestCount = count; bestGroup = group; if (count === 0) break; }
    }
    return bestGroup;
  }

  private selectBestSinglesPair(players: Player[]): Player[] {
    return [...players].sort((a, b) => (CourtAssignmentTracker.singleCountMap.get(a.id) ?? 0) - (CourtAssignmentTracker.singleCountMap.get(b.id) ?? 0)).slice(0, 2);
  }

  private hasTeammateConflict(p1: string, p2: string): boolean {
    return (CourtAssignmentTracker.teammateCountMap.get(this.pairKey(p1, p2)) ?? 0) > 0;
  }

  private countConflicts(pid: string, all: Player[]): number {
    return all.reduce((acc, p) => acc + (p.id !== pid && this.hasTeammateConflict(pid, p.id) ? 1 : 0), 0);
  }

  private countGroupConflicts(group: Player[]): number {
    let count = 0;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) count += (CourtAssignmentTracker.teammateCountMap.get(this.pairKey(group[i].id, group[j].id)) ?? 0);
    }
    return count;
  }

  private createOptimalTeams(players: Player[]): Court['teams'] {
    if (players.length === 4) return this.chooseBestTeamSplit(players).teams;
    if (players.length === 2) return { team1: [players[0]], team2: [players[1]] };
    return undefined;
  }

  private chooseBestTeamSplit(players: Player[]): { teams: Court['teams']; cost: number } {
    const splits: Array<[[number, number], [number, number]]> = [
      [[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]],
    ];
    let bestCost = Infinity;
    let bestTeams: Court['teams'];
    for (const split of splits) {
      const t1 = [players[split[0][0]], players[split[0][1]]];
      const t2 = [players[split[1][0]], players[split[1][1]]];
      let cost = 0;
      t1.forEach(a => t2.forEach(b => cost += (CourtAssignmentTracker.opponentCountMap.get(this.pairKey(a.id, b.id)) ?? 0) * this.OPPONENT_WEIGHT));
      const t1W = t1.reduce((a, p) => a + (CourtAssignmentTracker.winCountMap.get(p.id) ?? 0), 0);
      const t2W = t2.reduce((a, p) => a + (CourtAssignmentTracker.winCountMap.get(p.id) ?? 0), 0);
      cost += Math.abs(t1W - t2W) * this.BALANCE_WEIGHT;
      const t1L = t1.reduce((a, p) => a + (CourtAssignmentTracker.lossCountMap.get(p.id) ?? 0), 0);
      const t2L = t2.reduce((a, p) => a + (CourtAssignmentTracker.lossCountMap.get(p.id) ?? 0), 0);
      cost += Math.abs(t1L - t2L) * this.BALANCE_WEIGHT;
      if (cost < bestCost) { bestCost = cost; bestTeams = { team1: t1, team2: t2 }; }
    }
    return { teams: bestTeams, cost: bestCost };
  }

  override getStats() {
    const baseStats = super.getStats();
    return {
      ...baseStats,
      conflictEdges: Array.from(CourtAssignmentTracker.teammateCountMap.values()).filter(v => v > 0).length,
    };
  }
}

export const engineCG = new ConflictGraphEngine();
