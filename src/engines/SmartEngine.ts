import type { Court, ICourtAssignmentEngine, Player } from '../types';
import { DEFAULT_LEVEL } from '../types';

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

  protected evaluateTeamSplitCost(t1: Player[], t2: Player[]): number {
    return super.evaluateTeamSplitCost(t1, t2)
      + this.calculateGenderCost(t1, t2)
      + this.calculateLevelBalanceCost(t1, t2)
      + this.calculateLevelTeammateBias(t1)
      + this.calculateLevelTeammateBias(t2);
  }

  /** The team's single gender if every known-gender player shares it (and there are ≥2), else null. */
  private soleGender(team: Player[]): 'F' | 'M' | null {
    const known = team.filter(p => p.gender === 'F' || p.gender === 'M');
    if (known.length < 2) return null;
    if (known.every(p => p.gender === 'F')) return 'F';
    if (known.every(p => p.gender === 'M')) return 'M';
    return null;
  }

  /**
   * Penalizes matchups where one team is entirely F and the other is entirely M.
   * Players with Unknown or undefined gender are ignored; singles (1 known-gender
   * player per team) are not penalized.
   */
  protected calculateGenderCost(team1: Player[], team2: Player[]): number {
    const g1 = this.soleGender(team1);
    const g2 = this.soleGender(team2);
    return g1 && g2 && g1 !== g2 ? this.GENDER_MISMATCH_PENALTY : 0;
  }

  /**
   * Penalizes large level gaps between the two teams.
   * Missing level defaults to 50 (neutral).
   */
  protected calculateLevelBalanceCost(team1: Player[], team2: Player[]): number {
    const avg1 = team1.reduce((sum, p) => sum + (p.level ?? DEFAULT_LEVEL), 0) / team1.length;
    const avg2 = team2.reduce((sum, p) => sum + (p.level ?? DEFAULT_LEVEL), 0) / team2.length;
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
        cost += Math.abs((team[i].level ?? DEFAULT_LEVEL) - (team[j].level ?? DEFAULT_LEVEL)) * this.LEVEL_PAIR_BIAS;
      }
    }
    return cost;
  }

  protected courtSpecificCost(court: Court): number {
    if (!court.teams) return 0;
    return this.calculateGenderCost(court.teams.team1, court.teams.team2)
      + this.calculateLevelBalanceCost(court.teams.team1, court.teams.team2)
      + this.calculateLevelTeammateBias(court.teams.team1)
      + this.calculateLevelTeammateBias(court.teams.team2);
  }
}

export const engineSL = new SmartEngine();
