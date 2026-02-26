import type { Court, ICourtAssignmentEngine, Player } from '../types';

import { BaseCourtAssignmentEngine } from './BaseCourtAssignmentEngine';

/**
 * Gender/Level-Aware Smart Matching Engine
 *
 * Extends Simulated Annealing with additional cost functions that:
 * - Avoid gender-homogeneous matchups (all-F vs all-M)
 * - Penalize large level gaps between teams
 * - Provide a small bias toward similar-level teammates
 */
export class GenderLevelEngine extends BaseCourtAssignmentEngine implements ICourtAssignmentEngine {
  private readonly SA_ITERATIONS = 5000;
  private readonly INITIAL_TEMPERATURE = 2000.0;
  private readonly COOLING_RATE = 0.9995;
  private readonly MIN_TEMPERATURE = 0.1;

  private readonly TEAMMATE_REPEAT_PENALTY = 10000;
  private readonly OPPONENT_REPEAT_PENALTY = 50;
  private readonly BALANCE_PENALTY = 2000;
  private readonly SINGLES_REPEAT_PENALTY = 100;

  protected readonly GENDER_MISMATCH_PENALTY = 8000;
  protected readonly LEVEL_BALANCE_PENALTY = 80;
  protected readonly LEVEL_PAIR_BIAS = 15;

  getName(): string {
    return 'Smart Matching';
  }

  getDescription(): string {
    return 'Gender/Level-aware matching. Avoids gender-homogeneous matchups (FF vs MM) and extreme level gaps. Includes a small bias for similar-level teammates.';
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
    cost += this.calculateOpponentCost(t1, t2, this.OPPONENT_REPEAT_PENALTY);
    cost += this.calculateWinBalanceCost(t1, t2, this.BALANCE_PENALTY);
    cost += this.calculateGenderCost(t1, t2);
    cost += this.calculateLevelBalanceCost(t1, t2);
    cost += this.calculateLevelTeammateBias(t1);
    cost += this.calculateLevelTeammateBias(t2);
    return cost;
  }

  /**
   * Penalizes matchups where one team is entirely F and the other is entirely M.
   * Players with Unknown or undefined gender are ignored.
   */
  protected calculateGenderCost(team1: Player[], team2: Player[]): number {
    const knownTeam1 = team1.filter(p => p.sex === 'F' || p.sex === 'M');
    const knownTeam2 = team2.filter(p => p.sex === 'F' || p.sex === 'M');

    // Only penalize doubles: require at least 2 known-gender players per team
    if (knownTeam1.length < 2 || knownTeam2.length < 2) return 0;

    const allFemaleTeam1 = knownTeam1.every(p => p.sex === 'F');
    const allMaleTeam1 = knownTeam1.every(p => p.sex === 'M');
    const allFemaleTeam2 = knownTeam2.every(p => p.sex === 'F');
    const allMaleTeam2 = knownTeam2.every(p => p.sex === 'M');

    if ((allFemaleTeam1 && allMaleTeam2) || (allMaleTeam1 && allFemaleTeam2)) {
      return this.GENDER_MISMATCH_PENALTY;
    }

    return 0;
  }

  /**
   * Penalizes large level gaps between the two teams.
   * Missing level defaults to 50 (neutral).
   */
  protected calculateLevelBalanceCost(team1: Player[], team2: Player[]): number {
    const avg1 = team1.reduce((sum, p) => sum + (p.level ?? 50), 0) / team1.length;
    const avg2 = team2.reduce((sum, p) => sum + (p.level ?? 50), 0) / team2.length;
    return Math.abs(avg1 - avg2) * this.LEVEL_BALANCE_PENALTY;
  }

  /**
   * Small bias for pairing similar-level teammates.
   * Missing level defaults to 50 (neutral).
   */
  protected calculateLevelTeammateBias(team: Player[]): number {
    let cost = 0;
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        cost += Math.abs((team[i].level ?? 50) - (team[j].level ?? 50)) * this.LEVEL_PAIR_BIAS;
      }
    }
    return cost;
  }

  protected evaluateTotalCost(courts: Court[]): number {
    let totalCost = 0;
    for (const court of courts) {
      if (!court.teams) continue;
      if (court.players.length === 2) {
        totalCost += this.calculateSinglesCost(court.players, this.SINGLES_REPEAT_PENALTY);
      }
      totalCost += this.calculateTeammateCost(court.teams.team1, this.TEAMMATE_REPEAT_PENALTY);
      totalCost += this.calculateTeammateCost(court.teams.team2, this.TEAMMATE_REPEAT_PENALTY);
      totalCost += this.calculateOpponentCost(court.teams.team1, court.teams.team2, this.OPPONENT_REPEAT_PENALTY);
      totalCost += this.calculateWinBalanceCost(court.teams.team1, court.teams.team2, this.BALANCE_PENALTY);
      totalCost += this.calculateGenderCost(court.teams.team1, court.teams.team2);
      totalCost += this.calculateLevelBalanceCost(court.teams.team1, court.teams.team2);
      totalCost += this.calculateLevelTeammateBias(court.teams.team1);
      totalCost += this.calculateLevelTeammateBias(court.teams.team2);
    }
    return totalCost;
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
          if (bestCost === 0) console.log(`[GL ANNEAL] Found 0 cost at iteration ${i}, temp ${temperature.toFixed(2)}`);
        }
      }

      temperature *= this.COOLING_RATE;
    }
    console.log(`[GL ANNEAL] Finished. Best cost: ${bestCost}`);
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

export const engineGL = new GenderLevelEngine();
