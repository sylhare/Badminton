import type { Court, ICourtAssignmentEngine, Player } from '../types';

import { BaseCourtAssignmentEngine } from './BaseCourtAssignmentEngine';

/**
 * Abstract base class for Simulated Annealing engines.
 *
 * Implements the Template Method pattern for the SA loop.
 * Holds all shared SA infrastructure (loop, perturbation, constants).
 * Subclasses implement `evaluateTotalCost` and `evaluateTeamSplitCost`.
 */
export abstract class SimulatedAnnealingBase extends BaseCourtAssignmentEngine implements ICourtAssignmentEngine {
  SA_ITERATIONS: number = 500;
  INITIAL_TEMPERATURE: number = 2000.0;
  COOLING_RATE: number = 0.9995;
  protected MIN_TEMPERATURE: number = 0.1;

  protected readonly TEAMMATE_REPEAT_PENALTY = 10000;
  protected readonly OPPONENT_REPEAT_PENALTY = 50;
  protected readonly BALANCE_PENALTY = 2000;
  protected readonly SINGLES_REPEAT_PENALTY = 100;

  configure(params: Record<string, unknown>): void {
    if (typeof params.iterations === 'number') this.SA_ITERATIONS = params.iterations;
    if (typeof params.initialTemperature === 'number') this.INITIAL_TEMPERATURE = params.initialTemperature;
    if (typeof params.coolingRate === 'number') this.COOLING_RATE = params.coolingRate;
  }

  protected abstract evaluateTotalCost(courts: Court[]): number;

  protected generateAssignments(players: Player[], numberOfCourts: number, startCourtNum: number): Court[] {
    return this.runSimulatedAnnealing(players, numberOfCourts, startCourtNum);
  }

  protected getOptimalTeamSplit(players: Player[]): Court['teams'] {
    return this.chooseBestTeamSplit(players).teams;
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
          if (bestCost === 0) console.log(`[${this.name} ANNEAL] Found 0 cost at iteration ${i}, temp ${temperature.toFixed(2)}`);
        }
      }

      temperature *= this.COOLING_RATE;
    }
    console.log(`[${this.name} ANNEAL] Finished. Best cost: ${bestCost}`);
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

      const teams = this.createTeamsFromPlayers(courtPlayers);
      courts.push({ courtNumber: courtNum, players: courtPlayers, teams });
    }

    return courts;
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

    courts[courtA].teams = this.createTeamsFromPlayers(playersA);
    courts[courtB].teams = this.createTeamsFromPlayers(playersB);
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
}
