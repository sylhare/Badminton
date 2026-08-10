import { MatchScore } from '../scoring/MatchScore';

import { DEFAULT_SET_SIZE, standingsTied } from './types';
import type {
  SetScore,
  TournamentFormat,
  TournamentMatch,
  TournamentPhase,
  TournamentStandingRow,
  TournamentState,
  TournamentTeam,
} from './types';

export abstract class Tournament {
  protected readonly _state: TournamentState;

  constructor(state: TournamentState) {
    this._state = state;
  }

  state(): TournamentState {
    return this._state;
  }

  /** Derived from the matches: no matches → setup, all decided → completed, else active. */
  phase(): TournamentPhase {
    if (this._state.matches.length === 0) return 'setup';
    return this.isComplete() ? 'completed' : 'active';
  }

  format(): TournamentFormat {
    return this._state.format;
  }

  teams(): TournamentTeam[] {
    return this._state.teams;
  }

  matches(): TournamentMatch[] {
    return this._state.matches;
  }

  /** Reconstruct this exact tournament subclass around a new state (immutable copy). */
  protected rebuild(state: TournamentState): this {
    return new (this.constructor as new (s: TournamentState) => this)(state);
  }

  /** True when a non-empty set of matches all have a decided winner. */
  protected allDecided(matches: TournamentMatch[] = this._state.matches): boolean {
    return matches.length > 0 && matches.every(m => m.winner !== undefined);
  }

  /** Apply a result to one match by id, returning the updated match list. */
  protected replaceMatch(
    matches: TournamentMatch[],
    matchId: string,
    winner: 1 | 2,
    sets?: SetScore[],
  ): TournamentMatch[] {
    return matches.map(m => (m.id === matchId ? { ...m, winner, sets: sets ?? m.sets } : m));
  }

  /** Compose standings comparators into one: the first non-zero result wins. */
  protected orderStandings(
    comparators: Array<(a: TournamentStandingRow, b: TournamentStandingRow) => number>,
  ): (a: TournamentStandingRow, b: TournamentStandingRow) => number {
    return (a, b) => comparators.reduce((result, cmp) => result || cmp(a, b), 0);
  }

  withMatchResult(matchId: string, winner: 1 | 2, sets?: SetScore[]): this {
    return this.rebuild({
      ...this._state,
      matches: this.replaceMatch(this._state.matches, matchId, winner, sets),
    });
  }

  /**
   * The standings tiebreak for teams the metrics can't separate: a user-set manual order first
   * (more manual points ranks higher, just like the points column), then alphabetically by the
   * team's first player name. Only exact-tied teams ever reach this, and the tie-break modal
   * always ranks a whole tied run at once, so an unranked team is never dragged past a ranked one.
   */
  protected compareByTeamName(a: TournamentStandingRow, b: TournamentStandingRow): number {
    const points = this._state.manualPoints ?? {};
    const manual = (points[b.team.id] ?? 0) - (points[a.team.id] ?? 0);
    return manual || (a.team.players[0]?.name ?? '').localeCompare(b.team.players[0]?.name ?? '');
  }

  /**
   * Runs of two or more adjacent standings rows the metrics can't separate — each is a tie the
   * user must order by hand. Returns the row indices per run (only runs of length ≥ 2).
   */
  tieGroups(rows: TournamentStandingRow[]): number[][] {
    const groups: number[][] = [];
    let run: number[] = [];
    const flush = () => { if (run.length >= 2) groups.push(run); };
    for (let i = 0; i < rows.length; i++) {
      if (run.length === 0 || standingsTied(rows[run[0]], rows[i])) {
        run.push(i);
      } else {
        flush();
        run = [i];
      }
    }
    flush();
    return groups;
  }

  /** Points a side plays to in a set; drives the score modal's defaults. */
  setSize(): number {
    return this._state.setSize ?? DEFAULT_SET_SIZE;
  }

  /** Seeds a standings row per team and tallies played/won/lost/points/setDiff/scoreDiff over all decided matches. */
  protected tallyStandings(pointsPerWin = 0): Map<string, TournamentStandingRow> {
    const { teams, matches } = this._state;
    const standings = new Map<string, TournamentStandingRow>();
    for (const team of teams) {
      standings.set(team.id, { team, played: 0, won: 0, lost: 0, points: 0, setDiff: 0, scoreDiff: 0 });
    }
    for (const match of matches) {
      if (match.winner === undefined) continue;
      const row1 = standings.get(match.team1.id);
      const row2 = standings.get(match.team2.id);
      if (!row1 || !row2) continue;

      row1.played++;
      row2.played++;
      const [winRow, lossRow] = match.winner === 1 ? [row1, row2] : [row2, row1];
      winRow.won++;
      winRow.points += pointsPerWin;
      lossRow.lost++;

      const score = MatchScore.of(match.sets, match.winner);
      const sets = score.setsWon();
      row1.setDiff += sets.team1 - sets.team2;
      row2.setDiff += sets.team2 - sets.team1;

      const points = score.points();
      row1.scoreDiff += points.team1 - points.team2;
      row2.scoreDiff += points.team2 - points.team1;
    }
    return standings;
  }

  validate(teams: TournamentTeam[], format: TournamentFormat): string | null {
    if (teams.length < 2) return 'Need at least 2 teams to start';
    if (format === 'doubles') {
      for (const team of teams) {
        if (team.players.length !== 2) {
          return 'Each doubles team must have exactly 2 players';
        }
      }
    }
    return null;
  }

  /** Subtitle shown above the standings table. */
  standingsSubtitle(): string {
    const done = this.completedRounds();
    const total = this.totalRounds();
    return done > 0 ? `After Round ${done} / ${total}` : `Round 0 / ${total}`;
  }

  /** Whether the combined standings table is shown (formats with inline standings hide it). */
  showsCombinedStandings(): boolean {
    return true;
  }

  /** Whether the standings table shows a points column (knockout-only formats hide it). */
  showsPoints(): boolean {
    return true;
  }

  abstract start(teams: TournamentTeam[], numberOfCourts: number): Tournament;
  abstract calculateStandings(): TournamentStandingRow[];
  abstract completedRounds(): number;
  abstract totalRounds(): number;
  abstract isComplete(): boolean;
}
