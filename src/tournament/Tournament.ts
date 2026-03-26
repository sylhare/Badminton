import type {
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
    score?: { team1: number; team2: number },
  ): this {
    const newState: TournamentState = {
      ...this._state,
      matches: this._state.matches.map(m =>
        m.id === matchId ? { ...m, winner, score: score ?? m.score } : m,
      ),
    };
    return new (this.constructor as new (s: TournamentState) => this)(newState);
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
