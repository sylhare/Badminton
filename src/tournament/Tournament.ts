import type {
  SetScore,
  TournamentFormat,
  TournamentMatch,
  TournamentPhase,
  TournamentStandingRow,
  TournamentState,
  TournamentTeam,
} from './types';
import { setsWonBy, totalPoints } from './types';

export abstract class Tournament {
  protected readonly _state: TournamentState;

  constructor(state: TournamentState) {
    this._state = state;
  }

  state(): TournamentState {
    return this._state;
  }

  phase(): TournamentPhase {
    return this._state.phase;
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

  withMatchResult(
    matchId: string,
    winner: 1 | 2,
    sets?: SetScore[],
  ): this {
    const newState: TournamentState = {
      ...this._state,
      matches: this._state.matches.map(m =>
        m.id === matchId ? { ...m, winner, sets: sets ?? m.sets } : m,
      ),
    };
    return new (this.constructor as new (s: TournamentState) => this)(newState);
  }

  /** Stable standings tiebreak: alphabetical by the team's first player name. */
  protected compareByTeamName(a: TournamentStandingRow, b: TournamentStandingRow): number {
    return (a.team.players[0]?.name ?? '').localeCompare(b.team.players[0]?.name ?? '');
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

      const sets = setsWonBy(match);
      row1.setDiff += sets.team1 - sets.team2;
      row2.setDiff += sets.team2 - sets.team1;

      const points = totalPoints(match);
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

  abstract start(teams: TournamentTeam[], numberOfCourts: number): Tournament;
  abstract calculateStandings(): TournamentStandingRow[];
  abstract completedRounds(): number;
  abstract totalRounds(): number;
  abstract isComplete(): boolean;
}
