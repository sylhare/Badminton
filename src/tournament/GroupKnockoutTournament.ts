import type { Player } from '../types';
import { shuffleArray } from '../utils/playerUtils';

import { Tournament } from './Tournament';
import { RoundRobinTournament } from './RoundRobinTournament';
import { EliminationTournament } from './EliminationTournament';
import { roundRobinPairings } from './schedule';
import { partitionIntoGroups, seedQualifiers } from './groups';
import { makeId } from './ids';
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
const MIN_KNOCKOUT_TEAMS = 2;

/**
 * Two-phase tournament: a round-robin group stage followed by a knockout bracket
 * seeded from the top finishers of each group. This class owns the group phase,
 * the qualifier computation, and seeding results through into the knockout phase.
 */
export class GroupKnockoutTournament extends Tournament {
  private _groupsMemo?: TournamentTeam[][];
  private _qualifiersMemo?: TournamentTeam[];
  private _knockoutMemo?: EliminationTournament;

  private static sameSeeding(a: TournamentTeam[], b: TournamentTeam[]): boolean {
    return a.length === b.length && a.every((team, i) => team.id === b[i].id);
  }

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
          id: makeId('gk-match', index),
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
      teams: shuffled,
      numberOfCourts,
      matches,
    });
  }

  /** Group-stage matches (those tagged with a group index). */
  groupMatches(): TournamentMatch[] {
    return this._state.matches.filter(m => m.group !== undefined);
  }

  /**
   * The teams making up each group, indexed by group number. Derived from the
   * stored (shuffled) team list, which `start()` partitioned the same way and
   * which is never mutated afterwards.
   */
  groups(): TournamentTeam[][] {
    return (this._groupsMemo ??= partitionIntoGroups(this._state.teams, this.groupSize()));
  }

  /** A single group's matches as a round-robin sub-tournament, for standings and match rendering. */
  groupTournament(groupIndex: number): RoundRobinTournament {
    const groupTeams = this.groups()[groupIndex] ?? [];
    const groupMatches = this.groupMatches().filter(m => m.group === groupIndex);
    return RoundRobinTournament.fromState({
      ...this._state,
      type: 'round-robin',
      teams: groupTeams,
      matches: groupMatches,
    });
  }

  /** Standings within a single group, ranked like a round-robin. */
  groupStandings(groupIndex: number): TournamentStandingRow[] {
    return this.groupTournament(groupIndex).calculateStandings();
  }

  /** True once every group-stage match has a result. */
  groupPhaseComplete(): boolean {
    return this.allDecided(this.groupMatches());
  }

  /** Qualifying teams in knockout-seed order (empty until the group phase is complete). */
  qualifiers(): TournamentTeam[] {
    return (this._qualifiersMemo ??= this.computeQualifiers());
  }

  private computeQualifiers(): TournamentTeam[] {
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
    return (this._knockoutMemo ??= EliminationTournament.fromState({
      ...this._state,
      type: 'elimination',
      teams: this.qualifiers(),
      matches: this.knockoutMatches(),
    }));
  }

  /** Seed the knockout bracket from the group qualifiers, appending its first-round matches. */
  private startKnockout(qualifiers: TournamentTeam[]): GroupKnockoutTournament {
    const seeded = EliminationTournament
      .create(this._state.format, this._state.numberOfCourts, this._state.bestOf)
      .startSeeded(qualifiers, this._state.numberOfCourts);
    return new GroupKnockoutTournament({
      ...this._state,
      matches: [...this._state.matches, ...seeded.matches()],
      bracketSize: seeded.bracketSize(),
    });
  }

  private withState(matches: TournamentMatch[], bracketSize?: number): this {
    return this.rebuild({ ...this._state, matches, bracketSize: bracketSize ?? this._state.bracketSize });
  }

  override withMatchResult(matchId: string, winner: 1 | 2, sets?: SetScore[]): this {
    const existing = this._state.matches.find(m => m.id === matchId);
    if (!existing) return this;

    if (existing.bracket !== undefined) {
      const updatedKnockout = this.knockout().withMatchResult(matchId, winner, sets).matches();
      return this.withState([...this.groupMatches(), ...updatedKnockout]);
    }

    // A group-stage result changed. Recompute the group phase from the updated
    // matches alone, then (re)seed the knockout: editing a decided group result
    // after the bracket was seeded can change who qualifies, so a stale bracket
    // must be rebuilt (existing knockout matches are dropped) unless the seeding
    // is unchanged, in which case the played bracket is preserved.
    const updatedGroupMatches = this.replaceMatch(this.groupMatches(), matchId, winner, sets);
    const regrouped = new GroupKnockoutTournament({
      ...this._state,
      matches: updatedGroupMatches,
      bracketSize: undefined,
    });

    const qualifiers = regrouped.groupPhaseComplete() ? regrouped.qualifiers() : [];
    if (qualifiers.length < MIN_KNOCKOUT_TEAMS) {
      return this.withState(updatedGroupMatches);
    }
    if (this.knockoutStarted() && GroupKnockoutTournament.sameSeeding(this.qualifiers(), qualifiers)) {
      const kept = new GroupKnockoutTournament({
        ...this._state,
        matches: [...updatedGroupMatches, ...this.knockoutMatches()],
      });
      return this.withState(kept.matches(), kept.bracketSize());
    }
    const seeded = regrouped.startKnockout(qualifiers);
    return this.withState(seeded.matches(), seeded.bracketSize());
  }

  /** The group phase renders its own per-group standings tables, so the combined table is hidden. */
  override showsCombinedStandings(): boolean {
    return false;
  }

  calculateStandings(): TournamentStandingRow[] {
    return this.groups().flatMap((_, groupIndex) => this.groupStandings(groupIndex));
  }

  /** The whole group phase as one round-robin over every group's matches, for round counting. */
  private groupPhaseAsRoundRobin(): RoundRobinTournament {
    return RoundRobinTournament.fromState({
      ...this._state,
      type: 'round-robin',
      matches: this.groupMatches(),
    });
  }

  private completedGroupRounds(): number {
    return this.groupPhaseAsRoundRobin().completedRounds();
  }

  private groupTotalRounds(): number {
    return this.groupPhaseAsRoundRobin().totalRounds();
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
    if (!this.groupPhaseComplete()) return false;
    if (!this.knockoutStarted()) return this.qualifiers().length < MIN_KNOCKOUT_TEAMS;
    return this.allDecided();
  }
}
