import { shuffleArray } from '../utils/playerUtils';

import { Tournament } from './Tournament';
import { RoundRobinTournament } from './RoundRobinTournament';
import { EliminationTournament } from './EliminationTournament';
import { roundRobinPairings } from './schedule';
import { partitionIntoGroups, seedQualifiers } from './groups';
import { makeId } from './ids';
import { DEFAULT_SET_SIZE, DEFAULT_TOURNAMENT_STATE } from './types';
import type {
  SetScore,
  TournamentCreateOptions,
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
  private _groupMatchesMemo?: TournamentMatch[];
  private _knockoutMatchesMemo?: TournamentMatch[];
  private readonly _groupTournamentMemo = new Map<number, RoundRobinTournament>();
  private readonly _groupStandingsMemo = new Map<number, TournamentStandingRow[]>();
  private _overallStandingsMemo?: TournamentStandingRow[];
  private _groupPhaseMemo?: RoundRobinTournament;

  private static sameSeeding(a: TournamentTeam[], b: TournamentTeam[]): boolean {
    return a.length === b.length && a.every((team, i) => team.id === b[i].id);
  }

  static create(options: TournamentCreateOptions = {}): GroupKnockoutTournament {
    const {
      format = 'doubles',
      numberOfCourts = 4,
      bestOf = 1,
      groupSize = DEFAULT_GROUP_SIZE,
      qualifiersPerGroup = DEFAULT_QUALIFIERS_PER_GROUP,
      setSize = DEFAULT_SET_SIZE,
    } = options;
    return new GroupKnockoutTournament({
      ...DEFAULT_TOURNAMENT_STATE,
      type: 'group-knockout',
      format,
      numberOfCourts,
      bestOf,
      setSize,
      groupSize,
      qualifiersPerGroup,
    });
  }

  /**
   * How many teams actually advance for a given config: each group contributes at most
   * its own size (a 3-team group with 4 qualifiers still only sends 3).
   */
  private static advancingCount(
    teams: TournamentTeam[],
    groupSize: number,
    qualifiersPerGroup: number,
  ): number {
    return partitionIntoGroups(teams, groupSize)
      .reduce((total, group) => total + Math.min(qualifiersPerGroup, group.length), 0);
  }

  /**
   * Config error, else null. The knockout is only pointless when *every* team advances
   * (the group stage eliminates no one) — a group whose whole roster qualifies is fine
   * as long as some other group still cuts teams. Counting actual advancers avoids a
   * false alarm when uneven groups leave one group with exactly `qualifiersPerGroup` teams.
   */
  static validateConfig(teams: TournamentTeam[], groupSize: number, qualifiersPerGroup: number): string | null {
    if (teams.length === 0) return null;
    const advancing = GroupKnockoutTournament.advancingCount(teams, groupSize, qualifiersPerGroup);
    if (advancing >= teams.length) {
      return 'Every team would qualify — lower the qualifiers or raise the group size.';
    }
    if (advancing < MIN_KNOCKOUT_TEAMS) {
      return 'Too few teams would qualify for a knockout — add teams or lower the group size.';
    }
    return null;
  }

  static fromState(state: TournamentState): GroupKnockoutTournament {
    return new GroupKnockoutTournament(state);
  }

  groupSize(): number {
    return this._state.groupSize ?? DEFAULT_GROUP_SIZE;
  }

  qualifiersPerGroup(): number {
    return this._state.qualifiersPerGroup ?? DEFAULT_QUALIFIERS_PER_GROUP;
  }

  /** Peak concurrent group-stage matches: every group plays its same-numbered round at once. */
  static matchesPerRound(teams: TournamentTeam[], groupSize: number): number {
    return partitionIntoGroups(teams, groupSize)
      .reduce((total, group) => total + RoundRobinTournament.matchesPerRound(group), 0);
  }

  private static generateGroupMatches(
    groups: TournamentTeam[][],
    numberOfCourts: number,
  ): TournamentMatch[] {
    const matches: TournamentMatch[] = [];
    const courtsUsedInRound = new Map<number, number>();
    let index = 0;
    groups.forEach((groupTeams, groupIndex) => {
      for (const pairing of roundRobinPairings(groupTeams)) {
        const usedInRound = courtsUsedInRound.get(pairing.round) ?? 0;
        courtsUsedInRound.set(pairing.round, usedInRound + 1);
        matches.push({
          id: makeId('gk-match', index),
          round: pairing.round,
          courtNumber: (usedInRound % numberOfCourts) + 1,
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
    return (this._groupMatchesMemo ??= this._state.matches.filter(m => m.group !== undefined));
  }

  /**
   * The teams making up each group, indexed by group number. Derived from the
   * stored (shuffled) team list, which `start()` partitioned the same way and
   * which is never mutated afterwards.
   */
  groups(): TournamentTeam[][] {
    return (this._groupsMemo ??= partitionIntoGroups(this._state.teams, this.groupSize()));
  }

  /** Reinterpret this tournament's state as a plain round-robin, optionally over a team/match subset. */
  private asRoundRobin(overrides?: Partial<TournamentState>): RoundRobinTournament {
    return RoundRobinTournament.fromState({ ...this._state, type: 'round-robin', ...overrides });
  }

  /** A single group's matches as a round-robin sub-tournament, for standings and match rendering. */
  groupTournament(groupIndex: number): RoundRobinTournament {
    const cached = this._groupTournamentMemo.get(groupIndex);
    if (cached) return cached;
    const groupTeams = this.groups()[groupIndex] ?? [];
    const groupMatches = this.groupMatches().filter(m => m.group === groupIndex);
    const tournament = this.asRoundRobin({ teams: groupTeams, matches: groupMatches });
    this._groupTournamentMemo.set(groupIndex, tournament);
    return tournament;
  }

  /** Standings within a single group, ranked like a round-robin. */
  groupStandings(groupIndex: number): TournamentStandingRow[] {
    const cached = this._groupStandingsMemo.get(groupIndex);
    if (cached) return cached;
    const standings = this.groupTournament(groupIndex).calculateStandings();
    this._groupStandingsMemo.set(groupIndex, standings);
    return standings;
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
    if (!this.groupPhaseComplete() || this.hasUnresolvedBoundaryTie()) return [];
    const perGroup = this.groups().map((_, groupIndex) =>
      this.groupStandings(groupIndex).slice(0, this.qualifiersPerGroup()).map(row => row.team),
    );
    return seedQualifiers(perGroup);
  }

  /** True while a metrics tie straddles a group's qualification cut-off and lacks a hand-set order. */
  private hasUnresolvedBoundaryTie(): boolean {
    const cut = this.qualifiersPerGroup();
    const points = this._state.manualPoints ?? {};
    return this.groups().some((_, groupIndex) => {
      const standings = this.groupStandings(groupIndex);
      return this.tieGroups(standings).some(run => {
        const straddles = run.some(rank => rank < cut) && run.some(rank => rank >= cut);
        if (!straddles) return false;
        const ranked = run.map(rank => points[standings[rank].team.id]);
        return ranked.some(v => v === undefined) || new Set(ranked).size !== ranked.length;
      });
    });
  }

  /** Knockout-phase (bracket) matches. */
  knockoutMatches(): TournamentMatch[] {
    return (this._knockoutMatchesMemo ??= this._state.matches.filter(m => m.bracket !== undefined));
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
      manualPoints: undefined,
    }));
  }

  /** Seed the knockout bracket from the group qualifiers, appending its first-round matches. */
  private startKnockout(qualifiers: TournamentTeam[]): GroupKnockoutTournament {
    const { format, numberOfCourts, bestOf, setSize } = this._state;
    const seeded = EliminationTournament
      .create({ format, numberOfCourts, bestOf, setSize })
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

  /** A copy holding only the group phase (bracket dropped), the starting point for a (re)seed. */
  private regroupedWith(matches: TournamentMatch[], manualPoints?: Record<string, number>): GroupKnockoutTournament {
    return new GroupKnockoutTournament({ ...this._state, manualPoints, matches, bracketSize: undefined });
  }

  /** Manual tie-break points minus the given group's teams — a changed result there invalidates its hand-set order. */
  private manualPointsWithoutGroup(groupIndex?: number): Record<string, number> | undefined {
    const points = this._state.manualPoints;
    if (!points || groupIndex === undefined) return points;
    const groupIds = new Set(this.groups()[groupIndex]?.map(t => t.id));
    const kept = Object.entries(points).filter(([id]) => !groupIds.has(id));
    return kept.length ? Object.fromEntries(kept) : undefined;
  }

  override withMatchResult(matchId: string, winner: 1 | 2, sets?: SetScore[]): this {
    const existing = this._state.matches.find(m => m.id === matchId);
    if (!existing) return this;

    if (existing.bracket !== undefined) {
      const updatedKnockout = this.knockout().withMatchResult(matchId, winner, sets).matches();
      return this.withState([...this.groupMatches(), ...updatedKnockout]);
    }

    const groupMatches = this.replaceMatch(this.groupMatches(), matchId, winner, sets);
    const manualPoints = existing.winner === winner
      ? this._state.manualPoints
      : this.manualPointsWithoutGroup(existing.group);
    return this.reseedFrom(this.regroupedWith(groupMatches, manualPoints)) as this;
  }

  /**
   * Recompute qualifiers from `regrouped`'s group results and (re)seed the knockout to
   * match: keep an already-played bracket when the seeding is unchanged, otherwise rebuild
   * it (dropping any played knockout results). Compares against *this* instance's old
   * qualifiers/bracket, so it's shared by both a group-result edit and a manual re-ordering.
   */
  private reseedFrom(regrouped: GroupKnockoutTournament): GroupKnockoutTournament {
    const groupMatches = regrouped.groupMatches();
    const qualifiers = regrouped.qualifiers();

    if (qualifiers.length < MIN_KNOCKOUT_TEAMS) return regrouped.withState(groupMatches);
    if (this.knockoutStarted() && GroupKnockoutTournament.sameSeeding(this.qualifiers(), qualifiers)) {
      return regrouped.withState([...groupMatches, ...this.knockoutMatches()], this.bracketSize());
    }
    const seeded = regrouped.startKnockout(qualifiers);
    return regrouped.withState(seeded.matches(), seeded.bracketSize());
  }

  /**
   * Award manual tie-break points for a user-chosen ordering (best team first), then reseed
   * through the very same path a group-result edit uses — a re-order is just another change to
   * the group standings, so the knockout re-seeds (or stays put) by the existing rules.
   */
  withManualOrder(orderedIds: string[]): GroupKnockoutTournament {
    const manualPoints = { ...(this._state.manualPoints ?? {}) };
    orderedIds.forEach((id, index) => { manualPoints[id] = orderedIds.length - index; });
    return this.reseedFrom(this.regroupedWith(this.groupMatches(), manualPoints));
  }

  /** The group phase renders its own per-group standings tables, so the combined table is hidden. */
  override showsCombinedStandings(): boolean {
    return false;
  }

  calculateStandings(): TournamentStandingRow[] {
    return this.groups().flatMap((_, groupIndex) => this.groupStandings(groupIndex));
  }

  /**
   * The whole-tournament standings shown once it finishes: W/L/points/diffs summed across
   * both phases, ordered by knockout placement (champion, runner-up, semi-finalists, …) and
   * then by group performance for the teams that never reached the bracket.
   */
  overallStandings(): TournamentStandingRow[] {
    return (this._overallStandingsMemo ??= this.computeOverallStandings());
  }

  private computeOverallStandings(): TournamentStandingRow[] {
    const combined = this.asRoundRobin().calculateStandings();
    if (!this.knockoutStarted()) return combined;

    const byId = new Map(combined.map(row => [row.team.id, row]));
    const placed = this.knockout().calculateStandings()
      .map(row => byId.get(row.team.id))
      .filter((row): row is TournamentStandingRow => row !== undefined);
    const placedIds = new Set(placed.map(row => row.team.id));
    const rest = combined.filter(row => !placedIds.has(row.team.id));
    return [...placed, ...rest];
  }

  /** The whole group phase as one round-robin over every group's matches, for round counting. */
  private groupPhaseAsRoundRobin(): RoundRobinTournament {
    return (this._groupPhaseMemo ??= this.asRoundRobin({ matches: this.groupMatches() }));
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
    if (!this.knockoutStarted()) {
      return !this.hasUnresolvedBoundaryTie() && this.qualifiers().length < MIN_KNOCKOUT_TEAMS;
    }
    return this.allDecided();
  }
}
