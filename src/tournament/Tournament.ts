import type {
  TournamentFormat,
  TournamentMatch,
  TournamentPhase,
  TournamentStandingRow,
  TournamentState,
  TournamentTeam,
} from './types';

export abstract class Tournament {
  protected readonly state: TournamentState;

  constructor(state: TournamentState) {
    this.state = state;
  }

  getState(): TournamentState {
    return this.state;
  }

  getPhase(): TournamentPhase {
    return this.state.phase;
  }

  getFormat(): TournamentFormat {
    return this.state.format;
  }

  getTeams(): TournamentTeam[] {
    return this.state.teams;
  }

  getMatches(): TournamentMatch[] {
    return this.state.matches;
  }

  withMatchResult(
    matchId: string,
    winner: 1 | 2,
    score?: { team1: number; team2: number },
  ): this {
    const newState: TournamentState = {
      ...this.state,
      matches: this.state.matches.map(m =>
        m.id === matchId ? { ...m, winner, score: score ?? m.score } : m,
      ),
    };
    return new (this.constructor as new (s: TournamentState) => this)(newState);
  }

  abstract start(teams: TournamentTeam[], numberOfCourts: number): Tournament;
  abstract calculateStandings(): TournamentStandingRow[];
  abstract getCompletedRounds(): number;
  abstract getTotalRounds(): number;
  abstract validate(teams: TournamentTeam[], format: TournamentFormat): string | null;
}
