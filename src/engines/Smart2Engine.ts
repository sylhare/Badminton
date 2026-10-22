import type { Court, ICourtAssignmentEngine, Player } from '../types';
import { DEFAULT_LEVEL } from '../types';
import { pairKey } from '../utils/playerUtils';

import { SimulatedAnnealingBase } from './SimulatedAnnealingBase';

/** Sliding window engine with win momentum, mixed doubles preference, and pod repeat avoidance. */
export class Smart2Engine extends SimulatedAnnealingBase implements ICourtAssignmentEngine {
  override COOLING_RATE: number = 0.9985;
  levelWeight: number = 150;
  varietyWeight: number = 800;
  mixedDoublesWeight: number = 200;
  winStreakWeight: number = 300;
  windowTolerance: number = 25;
  podRepeatThreshold: number = 3;

  readonly name = 'Smart Matching v2';
  readonly description = 'Sliding window level grouping with win momentum and mixed doubles preference.';
  readonly descriptionKey = 'engine.smart2.description';

  /** Updates hyperparameter weights and simulated annealing settings. */
  override configure(params: Record<string, unknown>): void {
    super.configure(params);
    if (typeof params.levelWeight === 'number') this.levelWeight = params.levelWeight;
    if (typeof params.varietyWeight === 'number') this.varietyWeight = params.varietyWeight;
    if (typeof params.mixedDoublesWeight === 'number') this.mixedDoublesWeight = params.mixedDoublesWeight;
    if (typeof params.winStreakWeight === 'number') this.winStreakWeight = params.winStreakWeight;
    if (typeof params.windowTolerance === 'number') this.windowTolerance = params.windowTolerance;
    if (typeof params.podRepeatThreshold === 'number') this.podRepeatThreshold = params.podRepeatThreshold;
  }

  /** Computes momentum-adjusted player level clamped to 0..100. */
  calculateEffectiveLevel(player: Player): number {
    const baseLevel = player.level ?? DEFAULT_LEVEL;
    const wins = this.winCountMap.get(player.id) ?? 0;
    const losses = this.lossCountMap.get(player.id) ?? 0;
    const raw = baseLevel + (wins - losses) * (this.winStreakWeight / 100);
    return Math.max(0, Math.min(100, raw));
  }

  /** Evaluates teammate, opponent, and win balance costs using varietyWeight for opponents. */
  override sharedTeamCost(team1: Player[], team2: Player[]): number {
    return this.calculateTeammateCost(team1, this.TEAMMATE_REPEAT_PENALTY)
      + this.calculateTeammateCost(team2, this.TEAMMATE_REPEAT_PENALTY)
      + this.calculateOpponentCost(team1, team2, this.varietyWeight)
      + this.calculateWinBalanceCost(team1, team2, this.BALANCE_PENALTY);
  }

  /** Evaluates skill gap penalty between two opposing teams based on effective levels. */
  calculateTeamBalanceCost(team1: Player[], team2: Player[]): number {
    if (team1.length === 0 || team2.length === 0) return 0;
    const avg1 = team1.reduce((sum, p) => sum + this.calculateEffectiveLevel(p), 0) / team1.length;
    const avg2 = team2.reduce((sum, p) => sum + this.calculateEffectiveLevel(p), 0) / team2.length;
    return Math.abs(avg1 - avg2) * this.levelWeight;
  }

  /** Evaluates excess level spread penalty across all players on a court beyond tolerance. */
  calculateCourtSpreadCost(players: Player[]): number {
    if (players.length === 0) return 0;
    const levels = players.map(p => this.calculateEffectiveLevel(p));
    const maxLevel = Math.max(...levels);
    const minLevel = Math.min(...levels);
    return Math.max(0, maxLevel - minLevel - this.windowTolerance) * this.levelWeight;
  }

  /** Evaluates mixed doubles matchup bonus and FF vs MM mismatch penalty. */
  calculateMixedDoublesCost(team1: Player[], team2: Player[]): number {
    if (team1.length !== 2 || team2.length !== 2) return 0;
    const isFF = (t: Player[]) => t[0].gender === 'F' && t[1].gender === 'F';
    const isMM = (t: Player[]) => t[0].gender === 'M' && t[1].gender === 'M';
    const isMixed = (t: Player[]) =>
      (t[0].gender === 'M' && t[1].gender === 'F') || (t[0].gender === 'F' && t[1].gender === 'M');

    if ((isFF(team1) && isMM(team2)) || (isMM(team1) && isFF(team2))) {
      return this.mixedDoublesWeight;
    }
    if (isMixed(team1) && isMixed(team2)) {
      return -this.mixedDoublesWeight;
    }
    return 0;
  }

  /** Evaluates penalty when 3 or more pairs among the court pod players have co-played. */
  calculatePodRepeatCost(players: Player[]): number {
    if (players.length !== 4) return 0;
    let repeatCount = 0;
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const key = pairKey(players[i].id, players[j].id);
        const played = (this.teammateCountMap.get(key) ?? 0) > 0 || (this.opponentCountMap.get(key) ?? 0) > 0;
        if (played) {
          repeatCount++;
        }
      }
    }
    return repeatCount >= this.podRepeatThreshold ? this.varietyWeight * repeatCount : 0;
  }

  /** Evaluates full split cost including shared costs, balance, spread, mixed, and pod repetition. */
  override evaluateTeamSplitCost(team1: Player[], team2: Player[]): number {
    const courtPlayers = [...team1, ...team2];
    return super.evaluateTeamSplitCost(team1, team2)
      + this.calculateTeamBalanceCost(team1, team2)
      + this.calculateCourtSpreadCost(courtPlayers)
      + this.calculateMixedDoublesCost(team1, team2)
      + this.calculatePodRepeatCost(courtPlayers);
  }

  /** Evaluates court-specific cost terms including balance, spread, mixed doubles, and pod repetition. */
  override courtSpecificCost(court: Court): number {
    if (!court.teams) return 0;
    return this.calculateTeamBalanceCost(court.teams.team1, court.teams.team2)
      + this.calculateCourtSpreadCost(court.players)
      + this.calculateMixedDoublesCost(court.teams.team1, court.teams.team2)
      + this.calculatePodRepeatCost(court.players);
  }
}

/** Default singleton instance for Smart Matching v2. */
export const engineSL2 = new Smart2Engine();
