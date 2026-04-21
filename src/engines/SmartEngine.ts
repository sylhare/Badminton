import type { Court, ICourtAssignmentEngine, Player } from '../types';

import { SimulatedAnnealingBase } from './SimulatedAnnealingBase';

/**
 * Gender/Level-Aware Smart Matching Engine
 *
 * Extends Simulated Annealing with additional cost functions that:
 * - Avoid gender-homogeneous matchups (all-F vs all-M)
 * - Penalize large level gaps between teams
 * - Provide a small bias toward similar-level teammates
 */
export class SmartEngine extends SimulatedAnnealingBase implements ICourtAssignmentEngine {
  override COOLING_RATE: number = 0.9985;
  protected readonly GENDER_MISMATCH_PENALTY = 8000;
  protected readonly LEVEL_BALANCE_PENALTY = 250;
  protected readonly LEVEL_PAIR_BIAS = 120;

  readonly name = 'Smart Matching';
  readonly description = 'Gender/Level-aware matching. Avoids gender-homogeneous matchups (FF vs MM) and extreme level gaps. Includes a small bias for similar-level teammates.';

  supportsScoreTracking(): boolean {
    return true;
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
   * Only applies to doubles: singles (1 known-gender player per team) are not penalized.
   */
  protected calculateGenderCost(team1: Player[], team2: Player[]): number {
    const knownTeam1 = team1.filter(p => p.gender === 'F' || p.gender === 'M');
    const knownTeam2 = team2.filter(p => p.gender === 'F' || p.gender === 'M');

    if (knownTeam1.length < 2 || knownTeam2.length < 2) return 0;

    const allFemaleTeam1 = knownTeam1.every(p => p.gender === 'F');
    const allMaleTeam1 = knownTeam1.every(p => p.gender === 'M');
    const allFemaleTeam2 = knownTeam2.every(p => p.gender === 'F');
    const allMaleTeam2 = knownTeam2.every(p => p.gender === 'M');

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
}

export const engineSL = new SmartEngine();
