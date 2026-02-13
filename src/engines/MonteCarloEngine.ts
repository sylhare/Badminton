import type { Court, Player, ManualCourtSelection, ICourtAssignmentEngine } from '../types';
import { CourtAssignmentTracker } from './CourtAssignmentTracker';

/**
 * Monte Carlo Greedy Search Implementation
 * 
 * This engine generates multiple random configurations and selects the one
 * with the lowest heuristic cost.
 */
export class MonteCarloEngine extends CourtAssignmentTracker implements ICourtAssignmentEngine {
  private costCache: Map<string, number> = new Map();
  private readonly MAX_ATTEMPTS = 300;

  generate(
    players: Player[],
    numberOfCourts: number,
    manualSelection?: ManualCourtSelection,
    forceBenchPlayerIds?: Set<string>
  ): Court[] {
    const presentPlayers = players.filter(p => p.isPresent);
    if (presentPlayers.length === 0) return [];

    this.costCache.clear();

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

    let best: { courts: Court[]; cost: number } | null = null;
    for (let i = 0; i < this.MAX_ATTEMPTS; i++) {
      const cand = this.generateCandidate(onCourtPlayers, remainingCourts, manualCourtResult ? 2 : 1);
      if (!best || cand.cost < best.cost) best = cand;
    }

    let finalCourts = best ? best.courts : [];

    if (manualCourtResult) {
      finalCourts = [manualCourtResult, ...finalCourts];
    }

    benchedPlayers.forEach(p => this.recordBenching(p.id));
    finalCourts.forEach(court => {
      if (!court.teams) return;

      if (court.players.length === 2) {
        court.players.forEach(p => this.recordSingles(p.id));
      }

      const addTeamPairs = (team: Player[]): void => {
        for (let i = 0; i < team.length; i++) {
          for (let j = i + 1; j < team.length; j++) {
            this.recordTeammatePair(team[i].id, team[j].id);
          }
        }
      };

      addTeamPairs(court.teams.team1);
      addTeamPairs(court.teams.team2);

      court.teams.team1.forEach(a => {
        court.teams!.team2.forEach(b => {
          this.recordOpponentPair(a.id, b.id);
        });
      });
    });

    return finalCourts;
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

  private evaluateCourtCost(court: Court): number {
    if (!court.teams) return 0;
    const cacheKey = this.getCourtCacheKey(court);
    if (cacheKey && this.costCache.has(cacheKey)) return this.costCache.get(cacheKey)!;

    let cost = 0;

    if (court.players.length === 2) {
      const p1 = court.players[0].id;
      const p2 = court.players[1].id;
      cost += (CourtAssignmentTracker.singleCountMap.get(p1) ?? 0 + (CourtAssignmentTracker.singleCountMap.get(p2) ?? 0)) * 100;
    }

    const addTeamPairs = (team: Player[]): void => {
      for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) {
          cost += CourtAssignmentTracker.teammateCountMap.get(this.pairKey(team[i].id, team[j].id)) ?? 0;
        }
      }
    };

    addTeamPairs(court.teams.team1);
    addTeamPairs(court.teams.team2);

    court.teams.team1.forEach(a => {
      court.teams!.team2.forEach(b => {
        cost += CourtAssignmentTracker.opponentCountMap.get(this.pairKey(a.id, b.id)) ?? 0;
      });
    });

    const addSkillPairPenalty = (team: Player[]): void => {
      for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) {
          const wins1 = CourtAssignmentTracker.winCountMap.get(team[i].id) ?? 0;
          const wins2 = CourtAssignmentTracker.winCountMap.get(team[j].id) ?? 0;
          const losses1 = CourtAssignmentTracker.lossCountMap.get(team[i].id) ?? 0;
          const losses2 = CourtAssignmentTracker.lossCountMap.get(team[j].id) ?? 0;
          cost += wins1 * wins2 + losses1 * losses2;
        }
      }
    };

    addSkillPairPenalty(court.teams.team1);
    addSkillPairPenalty(court.teams.team2);

    const team1WinSum = court.teams.team1.reduce((acc, p) => acc + (CourtAssignmentTracker.winCountMap.get(p.id) ?? 0), 0);
    const team2WinSum = court.teams.team2.reduce((acc, p) => acc + (CourtAssignmentTracker.winCountMap.get(p.id) ?? 0), 0);
    cost += Math.abs(team1WinSum - team2WinSum);

    const team1LossSum = court.teams.team1.reduce((acc, p) => acc + (CourtAssignmentTracker.lossCountMap.get(p.id) ?? 0), 0);
    const team2LossSum = court.teams.team2.reduce((acc, p) => acc + (CourtAssignmentTracker.lossCountMap.get(p.id) ?? 0), 0);
    cost += Math.abs(team1LossSum - team2LossSum);

    if (cacheKey) this.costCache.set(cacheKey, cost);
    return cost;
  }

  private getCourtCacheKey(court: Court): string {
    if (!court.teams) return '';
    return [...court.teams.team1.map(p => p.id), ...court.teams.team2.map(p => p.id)].sort().join('|');
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