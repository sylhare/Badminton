import type { Court, Player } from '../types';
import { levelTracker } from '../engines/LevelTracker';
import type {
  MatchBracket,
  SEBracket,
  TournamentFormat,
  TournamentMatch,
  TournamentStandingRow,
  TournamentState,
  TournamentTeam,
  TournamentType,
} from '../types/tournament';

import { shuffleArray } from './playerUtils';

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
    if (type === 'elimination') {
      const { matches, seBracket } = Tournament._generateSEFirstStage(teams, numberOfCourts);
      return new Tournament({ phase: 'active', format, type, numberOfCourts, teams, matches, seBracket });
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
   * Elimination: ascending by losses → descending by wins → name.
   */
  getStandings(): TournamentStandingRow[] {
    const standings = Tournament._calculateStandings(this.state.teams, this.state.matches);
    if (this.state.type === 'elimination') {
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

  /** Total rounds: for SE returns log2(size) from start; for RR returns max round in match list. */
  getTotalRounds(): number {
    const { type, matches, seBracket } = this.state;
    if (type === 'elimination' && seBracket) {
      return Math.log2(seBracket.size);
    }
    if (matches.length === 0) return 0;
    return Math.max(...matches.map(m => m.round));
  }

  /**
   * True when the tournament has ended.
   * Elimination: all generated matches (WB + consolation) have results.
   * Round robin: all rounds are complete.
   */
  isComplete(): boolean {
    const { type, matches } = this.state;
    if (type === 'elimination') {
      return matches.length > 0 && matches.every(m => m.winner !== undefined);
    }
    const total = this.getTotalRounds();
    return total > 0 && this.getCompletedRounds() === total;
  }

  /**
   * Record a match result and return a new Tournament instance.
   * For elimination, automatically generates the next WB round, LB rounds, and GF
   * as prerequisites are met.
   *
   * Overload with `players`: also updates player levels via LevelTracker and returns
   * `{ tournament, players }` with the updated player list.
   */
  recordResult(matchId: string, winner: 1 | 2, score?: { team1: number; team2: number }): Tournament;
  recordResult(matchId: string, winner: 1 | 2, score: { team1: number; team2: number } | undefined, players: Player[]): { tournament: Tournament; players: Player[] };
  recordResult(
    matchId: string,
    winner: 1 | 2,
    score?: { team1: number; team2: number },
    players?: Player[],
  ): Tournament | { tournament: Tournament; players: Player[] } {
    let updatedMatches = this.state.matches.map(m =>
      m.id === matchId ? { ...m, winner, score: score ?? m.score } : m,
    );

    if (this.state.type === 'elimination' && this.state.seBracket) {
      const { seBracket, teams, numberOfCourts } = this.state;
      const wbRounds = Math.log2(seBracket.size);

      const wbMatches = updatedMatches.filter(m => Tournament.isWB(m));
      if (wbMatches.length > 0) {
        const maxWBRound = Math.max(...wbMatches.map(m => m.round));
        if (maxWBRound < wbRounds) {
          const currentWBRound = wbMatches.filter(m => m.round === maxWBRound);
          if (currentWBRound.every(m => m.winner !== undefined)) {
            const newWBMatches = Tournament._generateNextWBRound(
              seBracket, teams, updatedMatches, numberOfCourts,
            );
            updatedMatches = [...updatedMatches, ...newWBMatches];
          }
        }
      }

      let newDE = Tournament._computeNewDEMatches(seBracket, teams, numberOfCourts, updatedMatches);
      while (newDE.length > 0) {
        updatedMatches = [...updatedMatches, ...newDE];
        newDE = Tournament._computeNewDEMatches(seBracket, teams, numberOfCourts, updatedMatches);
      }
    }

    const newTournament = new Tournament({ ...this.state, matches: updatedMatches });

    if (players !== undefined) {
      return this._applyLevelUpdate(matchId, winner, score, players, newTournament);
    }

    return newTournament;
  }

  private _applyLevelUpdate(
    matchId: string,
    winner: 1 | 2,
    score: { team1: number; team2: number } | undefined,
    players: Player[],
    newTournament: Tournament,
  ): { tournament: Tournament; players: Player[] } {
    const match = this.state.matches.find(m => m.id === matchId);
    if (match) {
      const court: Court = {
        courtNumber: match.courtNumber,
        players: [...match.team1.players, ...match.team2.players],
        teams: { team1: match.team1.players, team2: match.team2.players },
        winner,
        score,
      };
      const updatedPlayers = levelTracker.updatePlayersLevels([court], players);
      return { tournament: newTournament, players: updatedPlayers };
    }
    return { tournament: newTournament, players };
  }

  static isWB(m: TournamentMatch): boolean {
    return (m.bracket ?? 'wb') === 'wb';
  }

  static isLB(m: TournamentMatch): boolean {
    return m.bracket === 'lb';
  }

  private static _makeTeamId(index: number): string {
    return `team-${Date.now()}-${index}`;
  }

  private static _makeMatchId(index: number): string {
    return `match-${Date.now()}-${index}`;
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

  private static _nextPowerOfTwo(n: number): number {
    let p = 1;
    while (p < n) p <<= 1;
    return p;
  }

  /**
   * Build the seeding array for a bracket of `size` slots with `teams.length` teams.
   * Fills consecutive slots with teams, leaving remaining slots as null.
   * Pairs: [A,B], [C,D], ... are real matches; [X,null] are byes; [null,null] produce no match/survivor.
   */
  private static _buildSESeeding(teams: TournamentTeam[], size: number): (string | null)[] {
    const n = teams.length;
    const seeding: (string | null)[] = new Array(size).fill(null);
    for (let i = 0; i < n; i++) {
      seeding[i] = teams[i].id;
    }
    return seeding;
  }

  private static _generateSEFirstStage(
    teams: TournamentTeam[],
    numberOfCourts: number,
  ): { matches: TournamentMatch[]; seBracket: SEBracket } {
    const size = Tournament._nextPowerOfTwo(teams.length);
    const shuffledTeams = shuffleArray(teams);
    const seeding = Tournament._buildSESeeding(shuffledTeams, size);
    const teamMap = new Map(teams.map(t => [t.id, t]));
    const matches: TournamentMatch[] = [];
    let matchIndex = 0;

    for (let i = 0; i < size / 2; i++) {
      const t1Id = seeding[2 * i];
      const t2Id = seeding[2 * i + 1];
      if (t1Id !== null && t2Id !== null) {
        matches.push({
          id: Tournament._makeMatchId(matchIndex),
          round: 1,
          bracket: 'wb',
          courtNumber: (matchIndex % numberOfCourts) + 1,
          team1: teamMap.get(t1Id)!,
          team2: teamMap.get(t2Id)!,
        });
        matchIndex++;
      }
    }

    return { matches, seBracket: { size, seeding } };
  }

  /**
   * Returns the ordered list of WB team IDs that advanced after `round` rounds.
   * Size of result: size / 2^round.
   * Bye slots advance automatically; real match slots use match winner.
   */
  private static _resolveSurvivors(
    seBracket: SEBracket,
    matches: TournamentMatch[],
    round: number,
  ): string[] {
    const { size, seeding } = seBracket;

    if (round === 1) {
      const survivors: string[] = [];
      for (let i = 0; i < size / 2; i++) {
        const t1Id = seeding[2 * i];
        const t2Id = seeding[2 * i + 1];
        if (t1Id === null && t2Id === null) {
          // null-null pair: no survivor
        } else if (t1Id === null) {
          survivors.push(t2Id!);
        } else if (t2Id === null) {
          survivors.push(t1Id);
        } else {
          const match = matches.find(
            m =>
              Tournament.isWB(m) &&
              m.round === 1 &&
              ((m.team1.id === t1Id && m.team2.id === t2Id) ||
               (m.team1.id === t2Id && m.team2.id === t1Id)),
          );
          survivors.push(match!.winner === 1 ? match!.team1.id : match!.team2.id);
        }
      }
      return survivors;
    }

    const prevSurvivors = Tournament._resolveSurvivors(seBracket, matches, round - 1);
    const survivors: string[] = [];
    for (let i = 0; i < Math.floor(prevSurvivors.length / 2); i++) {
      const t1Id = prevSurvivors[2 * i];
      const t2Id = prevSurvivors[2 * i + 1];
      const match = matches.find(
        m =>
          Tournament.isWB(m) &&
          m.round === round &&
          ((m.team1.id === t1Id && m.team2.id === t2Id) ||
           (m.team1.id === t2Id && m.team2.id === t1Id)),
      );
      survivors.push(match!.winner === 1 ? match!.team1.id : match!.team2.id);
    }
    // Odd survivor advances via bye (no match needed)
    if (prevSurvivors.length % 2 === 1) {
      survivors.push(prevSurvivors[prevSurvivors.length - 1]);
    }
    return survivors;
  }

  private static _generateNextWBRound(
    seBracket: SEBracket,
    teams: TournamentTeam[],
    completedMatches: TournamentMatch[],
    numberOfCourts: number,
  ): TournamentMatch[] {
    const wbMatches = completedMatches.filter(m => Tournament.isWB(m));
    const maxRound = Math.max(...wbMatches.map(m => m.round));
    const survivors = Tournament._resolveSurvivors(seBracket, completedMatches, maxRound);
    const nextRound = maxRound + 1;
    const teamMap = new Map(teams.map(t => [t.id, t]));
    const newMatches: TournamentMatch[] = [];

    for (let i = 0; i < Math.floor(survivors.length / 2); i++) {
      const matchIndex = completedMatches.length + newMatches.length;
      newMatches.push({
        id: Tournament._makeMatchId(matchIndex),
        round: nextRound,
        bracket: 'wb',
        courtNumber: (matchIndex % numberOfCourts) + 1,
        team1: teamMap.get(survivors[2 * i])!,
        team2: teamMap.get(survivors[2 * i + 1])!,
      });
    }

    return newMatches;
  }

  /**
   * Returns ordered loser IDs from WB round `wbRound`.
   * Order preserved from seeding walk (R1) or previous survivors (R2+).
   */
  private static _resolveWBLosers(
    seBracket: SEBracket,
    matches: TournamentMatch[],
    wbRound: number,
  ): string[] {
    const { size, seeding } = seBracket;

    if (wbRound === 1) {
      const losers: string[] = [];
      for (let i = 0; i < size / 2; i++) {
        const t1Id = seeding[2 * i];
        const t2Id = seeding[2 * i + 1];
        if (t1Id !== null && t2Id !== null) {
          const match = matches.find(
            m =>
              Tournament.isWB(m) &&
              m.round === 1 &&
              ((m.team1.id === t1Id && m.team2.id === t2Id) ||
               (m.team1.id === t2Id && m.team2.id === t1Id)),
          );
          if (match?.winner !== undefined) {
            losers.push(match.winner === 1 ? match.team2.id : match.team1.id);
          }
        }

      }
      return losers;
    }

    const prevSurvivors = Tournament._resolveSurvivors(seBracket, matches, wbRound - 1);
    const losers: string[] = [];
    for (let i = 0; i < Math.floor(prevSurvivors.length / 2); i++) {
      const t1Id = prevSurvivors[2 * i];
      const t2Id = prevSurvivors[2 * i + 1];
      const match = matches.find(
        m =>
          Tournament.isWB(m) &&
          m.round === wbRound &&
          ((m.team1.id === t1Id && m.team2.id === t2Id) ||
           (m.team1.id === t2Id && m.team2.id === t1Id)),
      );
      if (match?.winner !== undefined) {
        losers.push(match.winner === 1 ? match.team2.id : match.team1.id);
      }
    }
    return losers;
  }

  /**
   * Returns ordered LB survivor IDs after `lbRound` LB rounds.
   * Order follows match creation order (insertion order in the matches array).
   */
  private static _resolveLBSurvivors(
    matches: TournamentMatch[],
    lbRound: number,
  ): string[] {
    return matches
      .filter(m => Tournament.isLB(m) && m.round === lbRound && m.winner !== undefined)
      .map(m => (m.winner === 1 ? m.team1.id : m.team2.id));
  }

  /**
   * Computes any new LB / GF matches that can be generated given the current match list.
   * Returns an empty array when no new matches can be triggered.
   */
  private static _computeNewDEMatches(
    seBracket: SEBracket,
    teams: TournamentTeam[],
    numberOfCourts: number,
    currentMatches: TournamentMatch[],
  ): TournamentMatch[] {
    const wbRounds = Math.log2(seBracket.size);
    const lbRounds = 2 * (wbRounds - 1) - 1;

    if (lbRounds <= 0) return [];

    const teamMap = new Map(teams.map(t => [t.id, t]));
    const newMatches: TournamentMatch[] = [];

    const all = () => [...currentMatches, ...newMatches];
    const getWBRound = (r: number) => all().filter(m => Tournament.isWB(m) && m.round === r);
    const getLBRound = (r: number) => all().filter(m => Tournament.isLB(m) && m.round === r);

    const makeMatch = (t1Id: string, t2Id: string, round: number, bracket: MatchBracket): TournamentMatch => {
      const idx = all().length;
      return {
        id: Tournament._makeMatchId(idx),
        round,
        bracket,
        courtNumber: (idx % numberOfCourts) + 1,
        team1: teamMap.get(t1Id)!,
        team2: teamMap.get(t2Id)!,
      };
    };

    for (let lbRound = 1; lbRound <= lbRounds; lbRound++) {
      if (getLBRound(lbRound).length > 0) continue;

      if (lbRound === 1) {

        const wbR1 = getWBRound(1);
        if (!wbR1.length || !wbR1.every(m => m.winner !== undefined)) continue;
        const losers = Tournament._resolveWBLosers(seBracket, all(), 1);
        for (let i = 0; i < Math.floor(losers.length / 2); i++) {
          newMatches.push(makeMatch(losers[2 * i], losers[2 * i + 1], 1, 'lb'));
        }
      } else if (lbRound % 2 === 1) {

        const prevLB = getLBRound(lbRound - 1);
        if (!prevLB.length || !prevLB.every(m => m.winner !== undefined)) continue;
        const survivors = Tournament._resolveLBSurvivors(all(), lbRound - 1);
        for (let i = 0; i < Math.floor(survivors.length / 2); i++) {
          newMatches.push(makeMatch(survivors[2 * i], survivors[2 * i + 1], lbRound, 'lb'));
        }
      } else {

        const wbR = lbRound / 2 + 1;
        const prevLB = getLBRound(lbRound - 1);
        const wbRMatches = getWBRound(wbR);
        if (!prevLB.length || !prevLB.every(m => m.winner !== undefined)) continue;
        if (!wbRMatches.length || !wbRMatches.every(m => m.winner !== undefined)) continue;
        const lbSurvivors = Tournament._resolveLBSurvivors(all(), lbRound - 1);
        const wbLosers = Tournament._resolveWBLosers(seBracket, all(), wbR);
        for (let i = 0; i < lbSurvivors.length; i++) {
          newMatches.push(makeMatch(lbSurvivors[i], wbLosers[i], lbRound, 'lb'));
        }
      }
    }

    return newMatches;
  }
}
