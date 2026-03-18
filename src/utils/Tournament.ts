import type { Player } from '../types';
import type {
  DEBracket,
  TournamentFormat,
  TournamentMatch,
  TournamentStandingRow,
  TournamentState,
  TournamentTeam,
  TournamentType,
} from '../types/tournament';

export default class Tournament {
  private readonly state: TournamentState;

  private constructor(state: TournamentState) {
    this.state = state;
  }

  /**
   * Create and start a new tournament from a set of teams.
   * Generates the initial round of matches for the given type.
   */
  static start(
    teams: TournamentTeam[],
    numberOfCourts: number,
    format: TournamentFormat,
    type: TournamentType,
  ): Tournament {
    if (type === 'double-elimination') {
      const { matches, deBracket } = Tournament._generateDEFirstStage(teams, numberOfCourts);
      return new Tournament({ phase: 'active', format, type, numberOfCourts, teams, matches, deBracket });
    }
    const matches = Tournament._generateRoundRobinMatches(teams, numberOfCourts);
    return new Tournament({ phase: 'active', format, type, numberOfCourts, teams, matches });
  }

  /** Hydrate a Tournament instance from a stored TournamentState. */
  static from(state: TournamentState): Tournament {
    return new Tournament(state);
  }

  /** Create doubles teams by pairing consecutive players (2 per team). */
  static createDoubleTeams(players: Player[]): TournamentTeam[] {
    const teams: TournamentTeam[] = [];
    for (let i = 0; i < players.length; i += 2) {
      teams.push({ id: Tournament._makeTeamId(i), players: players.slice(i, i + 2) });
    }
    return teams;
  }

  /** Create singles teams by wrapping each player in their own team. */
  static createSingleTeams(players: Player[]): TournamentTeam[] {
    return players.map((p, i) => ({ id: Tournament._makeTeamId(i), players: [p] }));
  }

  /**
   * Validate teams before starting.
   * Returns an error message string, or null when valid.
   */
  static validate(teams: TournamentTeam[], format: TournamentFormat): string | null {
    if (teams.length < 2) return 'Need at least 2 teams to start';
    if (format === 'doubles') {
      for (const team of teams) {
        if (team.players.length !== 2) return 'Each doubles team must have exactly 2 players';
      }
    }
    return null;
  }

  /** Format a team's display name as "Player1 & Player2" (or just the single player name). */
  static formatTeamName(team: TournamentTeam): string {
    return team.players.map(p => p.name).join(' & ');
  }

  /** Sorted unique round numbers from a match list. */
  static getSortedRoundNums(matches: TournamentMatch[]): number[] {
    return Array.from(new Set(matches.map(m => m.round))).sort((a, b) => a - b);
  }

  /** Serialize this instance for storage. */
  toState(): TournamentState {
    return this.state;
  }

  /**
   * Standings sorted appropriately for the tournament type.
   * Round-robin: descending by points → scoreDiff → name.
   * Double elimination: ascending by losses → descending by wins → name.
   */
  getStandings(): TournamentStandingRow[] {
    const standings = Tournament._calculateStandings(this.state.teams, this.state.matches);
    if (this.state.type === 'double-elimination') {
      return [...standings].sort((a, b) => {
        if (a.lost !== b.lost) return a.lost - b.lost;
        if (b.won !== a.won) return b.won - a.won;
        return Tournament._compareTeamsByName(a, b);
      });
    }
    return standings;
  }

  /** Number of fully completed rounds (every match in the round has a winner). */
  getCompletedRounds(): number {
    const { matches } = this.state;
    if (matches.length === 0) return 0;

    const roundMap = new Map<number, TournamentMatch[]>();
    for (const match of matches) {
      if (!roundMap.has(match.round)) roundMap.set(match.round, []);
      roundMap.get(match.round)!.push(match);
    }

    let completed = 0;
    for (const round of Tournament.getSortedRoundNums(matches)) {
      if (roundMap.get(round)!.every(m => m.winner !== undefined)) {
        completed = round;
      } else {
        break;
      }
    }
    return completed;
  }

  /** Highest round number present in the match list. */
  getTotalRounds(): number {
    const { matches } = this.state;
    if (matches.length === 0) return 0;
    return Math.max(...matches.map(m => m.round));
  }

  /**
   * True when the tournament has ended.
   * Double elimination: the grand-final match has a winner.
   * Round robin: all rounds are complete.
   */
  isComplete(): boolean {
    const { type, matches } = this.state;
    if (type === 'double-elimination') {
      const gf = matches.find(m => m.bracket === 'grand-final');
      return gf !== undefined && gf.winner !== undefined;
    }
    const total = this.getTotalRounds();
    return total > 0 && this.getCompletedRounds() === total;
  }

  /**
   * Record a match result and return a new Tournament instance.
   * For double elimination, automatically generates the next stage when all
   * current matches are decided and the grand final is not yet complete.
   */
  recordResult(
    matchId: string,
    winner: 1 | 2,
    score?: { team1: number; team2: number },
  ): Tournament {
    const updatedMatches = this.state.matches.map(m =>
      m.id === matchId ? { ...m, winner, score: score ?? m.score } : m,
    );

    if (this.state.type === 'double-elimination') {
      const allDone = updatedMatches.every(m => m.winner !== undefined);
      const gf = updatedMatches.find(m => m.bracket === 'grand-final');
      const gfDone = gf !== undefined && gf.winner !== undefined;
      if (allDone && !gfDone) {
        const { newMatches, updatedBracket } = Tournament._generateNextDEStage(
          this.state.deBracket!,
          this.state.teams,
          updatedMatches,
          this.state.numberOfCourts,
        );
        return new Tournament({
          ...this.state,
          matches: [...updatedMatches, ...newMatches],
          deBracket: updatedBracket,
        });
      }
    }

    return new Tournament({ ...this.state, matches: updatedMatches });
  }

  private static _makeTeamId(index: number): string {
    return `team-${Date.now()}-${index}`;
  }

  private static _makeMatchId(index: number): string {
    return `match-${Date.now()}-${index}`;
  }

  private static _getWinnerId(match: TournamentMatch): string {
    return match.winner === 1 ? match.team1.id : match.team2.id;
  }

  private static _getLoserId(match: TournamentMatch): string {
    return match.winner === 1 ? match.team2.id : match.team1.id;
  }

  private static _compareTeamsByName(
    a: TournamentStandingRow,
    b: TournamentStandingRow,
  ): number {
    const nameA = a.team.players[0]?.name ?? '';
    const nameB = b.team.players[0]?.name ?? '';
    return nameA.localeCompare(nameB);
  }

  private static _calculateStandings(
    teams: TournamentTeam[],
    matches: TournamentMatch[],
  ): TournamentStandingRow[] {
    const standings = new Map<string, TournamentStandingRow>();
    for (const team of teams) {
      standings.set(team.id, { team, played: 0, won: 0, lost: 0, points: 0, scoreDiff: 0 });
    }

    for (const match of matches) {
      if (match.winner === undefined) continue;
      const row1 = standings.get(match.team1.id);
      const row2 = standings.get(match.team2.id);
      if (!row1 || !row2) continue;

      row1.played++;
      row2.played++;

      if (match.winner === 1) {
        row1.won++;
        row1.points += 2;
        row2.lost++;
      } else {
        row2.won++;
        row2.points += 2;
        row1.lost++;
      }

      if (match.score) {
        const diff = match.score.team1 - match.score.team2;
        row1.scoreDiff += diff;
        row2.scoreDiff -= diff;
      }
    }

    return Array.from(standings.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.scoreDiff !== a.scoreDiff) return b.scoreDiff - a.scoreDiff;
      return Tournament._compareTeamsByName(a, b);
    });
  }

  private static _generateRoundRobinMatches(
    teams: TournamentTeam[],
    numberOfCourts: number,
  ): TournamentMatch[] {
    const n = teams.length;
    if (n < 2) return [];

    const hasBye = n % 2 !== 0;
    const paddedTeams: (TournamentTeam | null)[] = hasBye ? [...teams, null] : [...teams];
    const m = paddedTeams.length;
    const matches: TournamentMatch[] = [];
    let matchIndex = 0;
    const rotating = paddedTeams.slice(1);

    for (let round = 0; round < m - 1; round++) {
      const roundTeams = [paddedTeams[0], ...rotating];
      for (let i = 0; i < m / 2; i++) {
        const t1 = roundTeams[i];
        const t2 = roundTeams[m - 1 - i];
        if (t1 === null || t2 === null) continue;
        matches.push({
          id: Tournament._makeMatchId(matchIndex),
          round: round + 1,
          courtNumber: (matchIndex % numberOfCourts) + 1,
          team1: t1,
          team2: t2,
        });
        matchIndex++;
      }
      const last = rotating.pop()!;
      rotating.unshift(last);
    }

    return matches;
  }

  private static _generateDEFirstStage(
    teams: TournamentTeam[],
    numberOfCourts: number,
  ): { matches: TournamentMatch[]; deBracket: DEBracket } {
    const wbSlots = teams.map(t => t.id);
    const teamMap = new Map(teams.map(t => [t.id, t]));
    const matches: TournamentMatch[] = [];
    let matchIndex = 0;

    const startIdx = wbSlots.length % 2 !== 0 ? 1 : 0;
    for (let i = startIdx; i + 1 < wbSlots.length; i += 2) {
      matches.push({
        id: Tournament._makeMatchId(matchIndex),
        round: 1,
        courtNumber: (matchIndex % numberOfCourts) + 1,
        team1: teamMap.get(wbSlots[i])!,
        team2: teamMap.get(wbSlots[i + 1])!,
        bracket: 'winners',
      });
      matchIndex++;
    }

    return { matches, deBracket: { wbSlots, lbSlots: [] } };
  }

  private static _generateNextDEStage(
    deBracket: DEBracket,
    teams: TournamentTeam[],
    completedMatches: TournamentMatch[],
    numberOfCourts: number,
  ): { newMatches: TournamentMatch[]; updatedBracket: DEBracket } {
    const teamMap = new Map(teams.map(t => [t.id, t]));
    const maxRound = Math.max(...completedMatches.map(m => m.round));
    const lastRoundMatches = completedMatches.filter(m => m.round === maxRound);
    const nextRound = maxRound + 1;

    const wbMatches = lastRoundMatches.filter(m => m.bracket === 'winners');
    const lbMatches = lastRoundMatches.filter(m => m.bracket === 'losers');

    const { wbSlots } = deBracket;
    const wbHadBye = wbSlots.length % 2 !== 0;
    const wbByeTeam = wbHadBye ? wbSlots[0] : null;

    const newWbSlots: string[] = wbByeTeam ? [wbByeTeam] : [];
    const newLbEntrants: string[] = [];

    for (const match of wbMatches) {
      newWbSlots.push(Tournament._getWinnerId(match));
      newLbEntrants.push(Tournament._getLoserId(match));
    }

    const survivingLbSlots: string[] = [];
    for (const match of lbMatches) {
      survivingLbSlots.push(Tournament._getWinnerId(match));
    }

    if (newWbSlots.length === 1 && survivingLbSlots.length === 1 && newLbEntrants.length === 0) {
      const matchIndex = completedMatches.length;
      const gfMatch: TournamentMatch = {
        id: Tournament._makeMatchId(matchIndex),
        round: nextRound,
        courtNumber: (matchIndex % numberOfCourts) + 1,
        team1: teamMap.get(newWbSlots[0])!,
        team2: teamMap.get(survivingLbSlots[0])!,
        bracket: 'grand-final',
      };
      return {
        newMatches: [gfMatch],
        updatedBracket: { wbSlots: newWbSlots, lbSlots: survivingLbSlots },
      };
    }

    const newLbPairs: [string, string][] = [];
    if (survivingLbSlots.length === 0) {
      for (let i = 0; i + 1 < newLbEntrants.length; i += 2) {
        newLbPairs.push([newLbEntrants[i], newLbEntrants[i + 1]]);
      }
    } else if (newLbEntrants.length > 0) {
      const pairCount = Math.min(survivingLbSlots.length, newLbEntrants.length);
      for (let i = 0; i < pairCount; i++) {
        newLbPairs.push([survivingLbSlots[i], newLbEntrants[i]]);
      }
      const extraSurvivors = survivingLbSlots.slice(pairCount);
      for (let i = 0; i + 1 < extraSurvivors.length; i += 2) {
        newLbPairs.push([extraSurvivors[i], extraSurvivors[i + 1]]);
      }
      const extraEntrants = newLbEntrants.slice(pairCount);
      for (let i = 0; i + 1 < extraEntrants.length; i += 2) {
        newLbPairs.push([extraEntrants[i], extraEntrants[i + 1]]);
      }
    } else {
      for (let i = 0; i + 1 < survivingLbSlots.length; i += 2) {
        newLbPairs.push([survivingLbSlots[i], survivingLbSlots[i + 1]]);
      }
    }

    const newMatches: TournamentMatch[] = [];
    let matchIndex = completedMatches.length;

    if (newWbSlots.length >= 2) {
      const wbHasNewBye = newWbSlots.length % 2 !== 0;
      const startIdx = wbHasNewBye ? 1 : 0;
      for (let i = startIdx; i + 1 < newWbSlots.length; i += 2) {
        newMatches.push({
          id: Tournament._makeMatchId(matchIndex),
          round: nextRound,
          courtNumber: (matchIndex % numberOfCourts) + 1,
          team1: teamMap.get(newWbSlots[i])!,
          team2: teamMap.get(newWbSlots[i + 1])!,
          bracket: 'winners',
        });
        matchIndex++;
      }
    }

    for (const [id1, id2] of newLbPairs) {
      newMatches.push({
        id: Tournament._makeMatchId(matchIndex),
        round: nextRound,
        courtNumber: (matchIndex % numberOfCourts) + 1,
        team1: teamMap.get(id1)!,
        team2: teamMap.get(id2)!,
        bracket: 'losers',
      });
      matchIndex++;
    }

    return {
      newMatches,
      updatedBracket: { wbSlots: newWbSlots, lbSlots: newLbPairs.flat() },
    };
  }
}
