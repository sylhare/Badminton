import type { Court, ICourtAssignmentEngine, Player } from '../types';

import { BaseCourtAssignmentEngine } from './BaseCourtAssignmentEngine';

/**
 * Simulated Annealing Implementation
 *
 * This engine uses simulated annealing to find a solution that minimizes
 * repetitions and balances teams.
 */
export class CourtAssignmentEngineSA extends BaseCourtAssignmentEngine implements ICourtAssignmentEngine {
  private readonly SA_ITERATIONS = 5000;
  private readonly INITIAL_TEMPERATURE = 2000.0;
  private readonly COOLING_RATE = 0.9995;
  private readonly MIN_TEMPERATURE = 0.1;

  private readonly TEAMMATE_REPEAT_PENALTY = 10000;
  private readonly OPPONENT_REPEAT_PENALTY = 50;
  private readonly SKILL_PAIR_PENALTY = 1000;
  private readonly BALANCE_PENALTY = 2000;
  private readonly SINGLES_REPEAT_PENALTY = 100;

  getName(): string {
    return 'Simulated Annealing';
  }

  getDescription(): string {
    return 'Simulated Annealing with iterative improvement. Performs 5000 iterations, accepting worse solutions probabilistically to escape local minima.';
  }

  protected generateAssignments(players: Player[], numberOfCourts: number, startCourtNum: number): Court[] {
    return this.runSimulatedAnnealing(players, numberOfCourts, startCourtNum);
  }

  protected getOptimalTeamSplit(players: Player[]): Court['teams'] {
    return this.chooseBestTeamSplit(players).teams;
  }

  protected evaluateTeamSplitCost(t1: Player[], t2: Player[]): number {
    let cost = 0;
    cost += this.calculateTeammateCost(t1, this.TEAMMATE_REPEAT_PENALTY);
    cost += this.calculateTeammateCost(t2, this.TEAMMATE_REPEAT_PENALTY);
    t1.forEach(a => t2.forEach(b =>
      cost += (this.opponentCountMap.get(this.pairKey(a.id, b.id)) ?? 0) * this.OPPONENT_REPEAT_PENALTY,
    ));

    const t1W = t1.reduce((a, p) => a + (this.winCountMap.get(p.id) ?? 0), 0);
    const t2W = t2.reduce((a, p) => a + (this.winCountMap.get(p.id) ?? 0), 0);
    cost += Math.abs(t1W - t2W) * this.BALANCE_PENALTY;
    return cost;
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
          if (bestCost === 0) console.log(`[SA ANNEAL] Found 0 cost at iteration ${i}, temp ${temperature.toFixed(2)}`);
        }
      }

      temperature *= this.COOLING_RATE;
    }
    console.log(`[SA ANNEAL] Finished. Best cost: ${bestCost}`);
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
        totalCost += ((this.singleCountMap.get(court.players[0].id) ?? 0) +
          (this.singleCountMap.get(court.players[1].id) ?? 0)) * this.SINGLES_REPEAT_PENALTY;
      }
      totalCost += this.calculateTeammateCost(court.teams.team1, this.TEAMMATE_REPEAT_PENALTY);
      totalCost += this.calculateTeammateCost(court.teams.team2, this.TEAMMATE_REPEAT_PENALTY);

      court.teams.team1.forEach(a => {
        court.teams!.team2.forEach(b => {
          totalCost += (this.opponentCountMap.get(this.pairKey(a.id, b.id)) ?? 0) * this.OPPONENT_REPEAT_PENALTY;
        });
      });

      totalCost += this.calculateSkillPairPenalty(court.teams.team1, this.SKILL_PAIR_PENALTY);
      totalCost += this.calculateSkillPairPenalty(court.teams.team2, this.SKILL_PAIR_PENALTY);

      const t1W = court.teams.team1.reduce((a, p) => a + (this.winCountMap.get(p.id) ?? 0), 0);
      const t2W = court.teams.team2.reduce((a, p) => a + (this.winCountMap.get(p.id) ?? 0), 0);
      totalCost += Math.abs(t1W - t2W) * this.BALANCE_PENALTY;

      const t1L = court.teams.team1.reduce((a, p) => a + (this.lossCountMap.get(p.id) ?? 0), 0);
      const t2L = court.teams.team2.reduce((a, p) => a + (this.lossCountMap.get(p.id) ?? 0), 0);
      totalCost += Math.abs(t1L - t2L) * this.BALANCE_PENALTY;
    }
    return totalCost;
  }
}

export const engineSA = new CourtAssignmentEngineSA();
