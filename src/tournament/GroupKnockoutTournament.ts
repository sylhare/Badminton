import type { Player } from '../types';
import { shuffleArray } from '../utils/playerUtils';

import { Tournament } from './Tournament';
import { RoundRobinTournament } from './RoundRobinTournament';
import { EliminationTournament } from './EliminationTournament';
import { roundRobinPairings } from './schedule';
import { partitionIntoGroups, seedQualifiers } from './groups';
import { DEFAULT_TOURNAMENT_STATE } from './types';
import type {
  SetScore,
  TournamentFormat,
  TournamentMatch,
  TournamentStandingRow,
  TournamentState,
  TournamentTeam,
} from './types';

const DEFAULT_GROUP_SIZE = 4;
const DEFAULT_QUALIFIERS_PER_GROUP = 2;

/**
 * Two-phase tournament: a round-robin group stage followed by a knockout bracket
 * seeded from the top finishers of each group. This class owns the group phase
 * and the qualifier computation; the knockout phase is wired up in a later step.
 */
export class GroupKnockoutTournament extends Tournament {
  static create(
    format: TournamentFormat = 'doubles',
    numberOfCourts = 4,
    bestOf = 1,
    groupSize = DEFAULT_GROUP_SIZE,
    qualifiersPerGroup = DEFAULT_QUALIFIERS_PER_GROUP,
  ): GroupKnockoutTournament {
    return new GroupKnockoutTournament({
      ...DEFAULT_TOURNAMENT_STATE,
      type: 'group-knockout',
      format,
      numberOfCourts,
      bestOf,
      groupSize,
      qualifiersPerGroup,
    });
  }

  static fromState(state: TournamentState): GroupKnockoutTournament {
    return new GroupKnockoutTournament(state);
  }

  static createTeams(players: Player[], format: TournamentFormat): TournamentTeam[] {
    return RoundRobinTournament.createTeams(players, format);
  }

  groupSize(): number {
    return this._state.groupSize ?? DEFAULT_GROUP_SIZE;
  }

  qualifiersPerGroup(): number {
    return this._state.qualifiersPerGroup ?? DEFAULT_QUALIFIERS_PER_GROUP;
  }

  private static generateGroupMatches(
    groups: TournamentTeam[][],
    numberOfCourts: number,
  ): TournamentMatch[] {
    const matches: TournamentMatch[] = [];
    let index = 0;
    groups.forEach((groupTeams, groupIndex) => {
      for (const pairing of roundRobinPairings(groupTeams)) {
        matches.push({
          id: `gk-match-${Date.now()}-${index}`,
          round: pairing.round,
          courtNumber: (index % numberOfCourts) + 1,
          team1: pairing.team1,
          team2: pairing.team2,
          sets: [],
          group: groupIndex,
        });
        index++;
      }
    });
    return matches;
  }

  start(teams: TournamentTeam[], numberOfCourts: number): GroupKnockoutTournament {
    const shuffled = shuffleArray(teams);
    const groups = partitionIntoGroups(shuffled, this.groupSize());
    const matches = GroupKnockoutTournament.generateGroupMatches(groups, numberOfCourts);
    return new GroupKnockoutTournament({
      ...this._state,
      phase: 'active',
      teams: shuffled,
      numberOfCourts,
      matches,
    });
  }

  /** Group-stage matches (those tagged with a group index). */
  groupMatches(): TournamentMatch[] {
    return this._state.matches.filter(m => m.group !== undefined);
  }

  /** The teams making up each group, indexed by group number. */
  groups(): TournamentTeam[][] {
    const groupMatches = this.groupMatches();
    if (groupMatches.length === 0) return [];

    const count = Math.max(...groupMatches.map(m => m.group!)) + 1;
    const groups: TournamentTeam[][] = Array.from({ length: count }, () => []);
    const seen = new Set<string>();
    for (const match of groupMatches) {
      for (const team of [match.team1, match.team2]) {
        const key = `${match.group}:${team.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        groups[match.group!].push(team);
      }
    }
    return groups;
  }

  /** Standings within a single group, ranked like a round-robin. */
  groupStandings(groupIndex: number): TournamentStandingRow[] {
    const groupTeams = this.groups()[groupIndex] ?? [];
    const groupMatches = this.groupMatches().filter(m => m.group === groupIndex);
    return RoundRobinTournament.fromState({
      ...this._state,
      type: 'round-robin',
      teams: groupTeams,
      matches: groupMatches,
    }).calculateStandings();
  }

  /** True once every group-stage match has a result. */
  groupPhaseComplete(): boolean {
    const groupMatches = this.groupMatches();
    return groupMatches.length > 0 && groupMatches.every(m => m.winner !== undefined);
  }

  /** Qualifying teams in knockout-seed order (empty until the group phase is complete). */
  qualifiers(): TournamentTeam[] {
    if (!this.groupPhaseComplete()) return [];
    const perGroup = this.groups().map((_, groupIndex) =>
      this.groupStandings(groupIndex).slice(0, this.qualifiersPerGroup()).map(row => row.team),
    );
    return seedQualifiers(perGroup);
  }

  /** Knockout-phase (bracket) matches. */
  knockoutMatches(): TournamentMatch[] {
    return this._state.matches.filter(m => m.bracket !== undefined);
  }

  /** True once the group phase has finished and the knockout bracket has been seeded. */
  knockoutStarted(): boolean {
    return this.knockoutMatches().length > 0;
  }

  bracketSize(): number {
    return this._state.bracketSize ?? 0;
  }

  /** The knockout phase as an EliminationTournament over the seeded qualifiers. */
  knockout(): EliminationTournament {
    return EliminationTournament.fromState({
      ...this._state,
      type: 'elimination',
      teams: this.qualifiers(),
      bracketSize: this._state.bracketSize,
      matches: this.knockoutMatches(),
    });
  }

  /** Seed the knockout bracket from the group qualifiers, appending its first-round matches. */
  private startKnockout(): GroupKnockoutTournament {
    const seeded = EliminationTournament
      .create(this._state.format, this._state.numberOfCourts, this._state.bestOf)
      .startSeeded(this.qualifiers(), this._state.numberOfCourts);
    return new GroupKnockoutTournament({
      ...this._state,
      matches: [...this._state.matches, ...seeded.matches()],
      bracketSize: seeded.bracketSize(),
    });
  }

  private withPhase(matches: TournamentMatch[], bracketSize?: number): GroupKnockoutTournament {
    const next = new GroupKnockoutTournament({
      ...this._state,
      matches,
      bracketSize: bracketSize ?? this._state.bracketSize,
    });
    return new GroupKnockoutTournament({ ...next._state, phase: next.isComplete() ? 'completed' : 'active' });
  }

  override withMatchResult(matchId: string, winner: 1 | 2, sets?: SetScore[]): this {
    const existing = this._state.matches.find(m => m.id === matchId);
    if (!existing) return this;

    // Knockout match: delegate to the elimination sub-tournament, which handles
    // follow-up generation and cascade-deletes, then splice its matches back in.
    if (existing.bracket !== undefined) {
      const updatedKnockout = this.knockout().withMatchResult(matchId, winner, sets).matches();
      return this.withPhase([...this.groupMatches(), ...updatedKnockout]) as this;
    }

    // Group match: record the result, then seed the knockout if the group phase just finished.
    const updatedMatches = this._state.matches.map(m =>
      m.id === matchId ? { ...m, winner, sets: sets ?? m.sets } : m,
    );
    let next = new GroupKnockoutTournament({ ...this._state, matches: updatedMatches });
    if (!next.knockoutStarted() && next.groupPhaseComplete()) {
      next = next.startKnockout();
    }
    return this.withPhase(next.matches(), next.bracketSize()) as this;
  }

  calculateStandings(): TournamentStandingRow[] {
    return this.groups().flatMap((_, groupIndex) => this.groupStandings(groupIndex));
  }

  private completedGroupRounds(): number {
    const groupMatches = this.groupMatches();
    if (groupMatches.length === 0) return 0;

    const rounds = Array.from(new Set(groupMatches.map(m => m.round))).sort((a, b) => a - b);
    let completed = 0;
    for (const round of rounds) {
      if (groupMatches.filter(m => m.round === round).every(m => m.winner !== undefined)) {
        completed = round;
      } else {
        break;
      }
    }
    return completed;
  }

  private groupTotalRounds(): number {
    const groupMatches = this.groupMatches();
    return groupMatches.length ? Math.max(...groupMatches.map(m => m.round)) : 0;
  }

  completedRounds(): number {
    if (!this.groupPhaseComplete()) return this.completedGroupRounds();
    const knockoutDone = this.knockoutStarted() ? this.knockout().completedRounds() : 0;
    return this.groupTotalRounds() + knockoutDone;
  }

  totalRounds(): number {
    const knockoutRounds = this.knockoutStarted() ? this.knockout().totalRounds() : 0;
    return this.groupTotalRounds() + knockoutRounds;
  }

  isComplete(): boolean {
    if (!this.knockoutStarted()) return false;
    const { matches } = this._state;
    return matches.length > 0 && matches.every(m => m.winner !== undefined);
  }
}
