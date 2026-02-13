import type { Court, Player, ManualCourtSelection, ICourtAssignmentEngine } from '../types';
import { CourtAssignmentTracker } from './CourtAssignmentTracker';

/**
 * Simulated Annealing Implementation
 * 
 * This engine uses simulated annealing to find a solution that minimizes
 * repetitions and balances teams.
 */
export class CourtAssignmentEngineSA extends CourtAssignmentTracker implements ICourtAssignmentEngine {
  private readonly SA_ITERATIONS = 5000;
  private readonly INITIAL_TEMPERATURE = 100.0;
  private readonly COOLING_RATE = 0.9995;
  private readonly MIN_TEMPERATURE = 0.1;

  private readonly TEAMMATE_REPEAT_PENALTY = 10000;
  private readonly OPPONENT_REPEAT_PENALTY = 50;
  private readonly SKILL_PAIR_PENALTY = 1;
  private readonly BALANCE_PENALTY = 2;
  private readonly SINGLES_REPEAT_PENALTY = 100;

  generate(players: Player[], numberOfCourts: number, manualSelection?: ManualCourtSelection): Court[] {
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

    const benchedPlayers = this.selectBenchedPlayers(remainingPlayers, benchSpots);
    const onCourtPlayers = remainingPlayers.filter(p => !benchedPlayers.includes(p));

    const startCourtNum = manualCourtResult ? 2 : 1;
    const saCourts = this.runSimulatedAnnealing(onCourtPlayers, remainingCourts, startCourtNum);

    let finalCourts = saCourts;

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

  private runSimulatedAnnealing(players: Player[], numberOfCourts: number, startCourtNum: number): Court[] {
    if (players.length < 2) return [];

    let current = this.generateInitialSolution(players, numberOfCourts, startCourtNum);
    let currentCost = this.evaluateTotalCost(current);
    let best = this.cloneCourts(current);
    let bestCost = currentCost;

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
        }
      }

      temperature *= this.COOLING_RATE;
    }

    return best;
  }

  private generateInitialSolution(players: Player[], numberOfCourts: number, startCourtNum: number): Court[] {
    const courts: Court[] = [];
    const shuffled = this.shuffleArray([...players]);

    let idx = 0;
    for (let courtNum = startCourtNum; courtNum < startCourtNum + numberOfCourts; courtNum++) {
      const courtPlayers = shuffled.slice(idx, idx + 4);
      idx += 4;
      if (courtPlayers.length < 2) break;
      if (courtPlayers.length === 3) {
        idx--;
        courtPlayers.pop();
      }

      const teams = this.createTeams(courtPlayers);
      courts.push({ courtNumber: courtNum, players: courtPlayers, teams });
    }

    return courts;
  }

  private createTeams(players: Player[]): Court['teams'] {
    if (players.length === 4) {
      return this.chooseBestTeamSplit(players).teams;
    } else if (players.length === 2) {
      return { team1: [players[0]], team2: [players[1]] };
    }
    return undefined;
  }

  private perturbSolution(courts: Court[]): Court[] {
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

  private swapPlayersBetweenCourts(courts: Court[]): void {
    const courtA = Math.floor(Math.random() * courts.length);
    let courtB = Math.floor(Math.random() * courts.length);
    while (courtB === courtA && courts.length > 1) courtB = Math.floor(Math.random() * courts.length);

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

  private resplitCourtTeams(courts: Court[]): void {
    const courtIdx = Math.floor(Math.random() * courts.length);
    const court = courts[courtIdx];
    if (court.players.length === 4) {
      this.shuffleArray(court.players);
      court.teams = this.chooseBestTeamSplit(court.players).teams;
    }
  }

  private swapWithinCourt(courts: Court[]): void {
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

  private cloneCourts(courts: Court[]): Court[] {
    return courts.map(court => ({
      courtNumber: court.courtNumber,
      players: [...court.players],
      teams: court.teams ? { team1: [...court.teams.team1], team2: [...court.teams.team2] } : undefined,
      winner: court.winner,
    }));
  }

  private evaluateTotalCost(courts: Court[]): number {
    let totalCost = 0;
    for (const court of courts) {
      if (!court.teams) continue;
      if (court.players.length === 2) {
        totalCost += ((CourtAssignmentTracker.singleCountMap.get(court.players[0].id) ?? 0) + (CourtAssignmentTracker.singleCountMap.get(court.players[1].id) ?? 0)) * this.SINGLES_REPEAT_PENALTY;
      }
      const addTeammateCost = (team: Player[]): void => {
        for (let i = 0; i < team.length; i++) {
          for (let j = i + 1; j < team.length; j++) {
            totalCost += (CourtAssignmentTracker.teammateCountMap.get(this.pairKey(team[i].id, team[j].id)) ?? 0) * this.TEAMMATE_REPEAT_PENALTY;
          }
        }
      };
      addTeammateCost(court.teams.team1);
      addTeammateCost(court.teams.team2);

      court.teams.team1.forEach(a => {
        court.teams!.team2.forEach(b => {
          totalCost += (CourtAssignmentTracker.opponentCountMap.get(this.pairKey(a.id, b.id)) ?? 0) * this.OPPONENT_REPEAT_PENALTY;
        });
      });

      const addSkillPairPenalty = (team: Player[]): void => {
        for (let i = 0; i < team.length; i++) {
          for (let j = i + 1; j < team.length; j++) {
            const wins1 = CourtAssignmentTracker.winCountMap.get(team[i].id) ?? 0;
            const wins2 = CourtAssignmentTracker.winCountMap.get(team[j].id) ?? 0;
            const losses1 = CourtAssignmentTracker.lossCountMap.get(team[i].id) ?? 0;
            const losses2 = CourtAssignmentTracker.lossCountMap.get(team[j].id) ?? 0;
            totalCost += (wins1 * wins2 + losses1 * losses2) * this.SKILL_PAIR_PENALTY;
          }
        }
      };
      addSkillPairPenalty(court.teams.team1);
      addSkillPairPenalty(court.teams.team2);

      const t1W = court.teams.team1.reduce((a, p) => a + (CourtAssignmentTracker.winCountMap.get(p.id) ?? 0), 0);
      const t2W = court.teams.team2.reduce((a, p) => a + (CourtAssignmentTracker.winCountMap.get(p.id) ?? 0), 0);
      totalCost += Math.abs(t1W - t2W) * this.BALANCE_PENALTY;

      const t1L = court.teams.team1.reduce((a, p) => a + (CourtAssignmentTracker.lossCountMap.get(p.id) ?? 0), 0);
      const t2L = court.teams.team2.reduce((a, p) => a + (CourtAssignmentTracker.lossCountMap.get(p.id) ?? 0), 0);
      totalCost += Math.abs(t1L - t2L) * this.BALANCE_PENALTY;
    }
    return totalCost;
  }

  private chooseBestTeamSplit(players: Player[]): { teams: Court['teams']; cost: number } {
    const splits: Array<[[number, number], [number, number]]> = [
      [[0, 1], [2, 3]],
      [[0, 2], [1, 3]],
      [[0, 3], [1, 2]],
    ];
    let bestCost = Infinity;
    let bestTeams: Court['teams'];
    splits.forEach(split => {
      const t1 = [players[split[0][0]], players[split[0][1]]];
      const t2 = [players[split[1][0]], players[split[1][1]]];
      const cost = this.evaluateSplitCost(t1, t2);
      if (cost < bestCost) { bestCost = cost; bestTeams = { team1: t1, team2: t2 }; }
    });
    return { teams: bestTeams, cost: bestCost };
  }

  private evaluateSplitCost(t1: Player[], t2: Player[]): number {
    let cost = 0;
    const addTMC = (team: Player[]) => {
      for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) {
          cost += (CourtAssignmentTracker.teammateCountMap.get(this.pairKey(team[i].id, team[j].id)) ?? 0) * this.TEAMMATE_REPEAT_PENALTY;
        }
      }
    };
    addTMC(t1); addTMC(t2);
    t1.forEach(a => t2.forEach(b => cost += (CourtAssignmentTracker.opponentCountMap.get(this.pairKey(a.id, b.id)) ?? 0) * this.OPPONENT_REPEAT_PENALTY));
    const t1W = t1.reduce((a, p) => a + (CourtAssignmentTracker.winCountMap.get(p.id) ?? 0), 0);
    const t2W = t2.reduce((a, p) => a + (CourtAssignmentTracker.winCountMap.get(p.id) ?? 0), 0);
    cost += Math.abs(t1W - t2W) * this.BALANCE_PENALTY;
    return cost;
  }

  getStats() {
    const teammateValues = Array.from(CourtAssignmentTracker.teammateCountMap.values());
    const opponentValues = Array.from(CourtAssignmentTracker.opponentCountMap.values());
    return {
      totalTeammatePairs: teammateValues.length,
      maxTeammateCount: Math.max(0, ...teammateValues),
      avgTeammateCount: teammateValues.length > 0 ? teammateValues.reduce((a, b) => a + b, 0) / teammateValues.length : 0,
      totalOpponentPairs: opponentValues.length,
      maxOpponentCount: Math.max(0, ...opponentValues),
    };
  }
}

export const engineSA = new CourtAssignmentEngineSA();
