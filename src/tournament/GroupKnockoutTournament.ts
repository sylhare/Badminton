import type { Player } from '../types';
import { shuffleArray } from '../utils/playerUtils';

import { Tournament } from './Tournament';
import { RoundRobinTournament } from './RoundRobinTournament';
import { roundRobinPairings } from './schedule';
import { partitionIntoGroups, seedQualifiers } from './groups';
import { DEFAULT_TOURNAMENT_STATE } from './types';
import type {
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

  calculateStandings(): TournamentStandingRow[] {
    return this.groups().flatMap((_, groupIndex) => this.groupStandings(groupIndex));
  }

  completedRounds(): number {
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

  totalRounds(): number {
    const groupMatches = this.groupMatches();
    return groupMatches.length ? Math.max(...groupMatches.map(m => m.round)) : 0;
  }

  isComplete(): boolean {
    const { matches } = this._state;
    return matches.length > 0 && matches.every(m => m.winner !== undefined);
  }
}
