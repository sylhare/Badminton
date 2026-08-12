import { shuffleArray } from '../utils/playerUtils';

import { Tournament } from './Tournament';
import { BracketKind, DEFAULT_SET_SIZE, DEFAULT_TOURNAMENT_STATE } from './types';
import type {
  SetScore,
  TournamentCreateOptions,
  TournamentMatch,
  TournamentStandingRow,
  TournamentState,
  TournamentTeam,
} from './types';
import { makeId } from './ids';
import type { SeedSlots } from './bracketTree';
import {
  ConsolationBracket,
  WinnersBracket,
  findMatchBetween,
  getCBExpectedPool,
  getWBSemiFinalLosers,
  getWinnersFirstRoundLoser,
  loserOf,
  nextPowerOf2,
  positionsInRound,
  resolvePosition,
  roundComplete,
} from './bracketTree';

export class EliminationTournament extends Tournament {
  static create(options: TournamentCreateOptions = {}): EliminationTournament {
    const { format = 'doubles', numberOfCourts = 4, bestOf = 1, setSize = DEFAULT_SET_SIZE } = options;
    return new EliminationTournament({
      ...DEFAULT_TOURNAMENT_STATE,
      type: 'elimination',
      format,
      numberOfCourts,
      bestOf,
      setSize,
    });
  }

  static fromState(state: TournamentState): EliminationTournament {
    return new EliminationTournament(state);
  }

  private makeMatch(
    bracket: BracketKind,
    round: number,
    team1: TournamentTeam,
    team2: TournamentTeam,
    courtIndex: number,
  ): TournamentMatch {
    return {
      id: makeId('elim-match', courtIndex),
      round,
      courtNumber: (courtIndex % this._state.numberOfCourts) + 1,
      team1,
      team2,
      sets: [],
      bracket,
    };
  }

  private roundExists(matches: TournamentMatch[], round: number): boolean {
    return matches.some(m => m.round === round);
  }

  private pairTeamsIntoMatches(
    bracket: BracketKind,
    round: number,
    teams: TournamentTeam[],
    startCourtIndex: number,
  ): TournamentMatch[] {
    const matches: TournamentMatch[] = [];
    for (let i = 0; i < Math.floor(teams.length / 2); i++) {
      matches.push(this.makeMatch(bracket, round, teams[2 * i], teams[2 * i + 1], startCourtIndex + i));
    }
    return matches;
  }

  private generateWinnersFirstRound(): TournamentMatch[] {
    const { teams } = this._state;
    const bracketSize = this.bracketSize();
    const matches: TournamentMatch[] = [];
    let courtIndex = 0;
    for (let pos = 0; pos < bracketSize / 2; pos++) {
      const team1 = teams[2 * pos];
      const team2 = teams[2 * pos + 1];
      if (team1 && team2) {
        matches.push(this.makeMatch(BracketKind.Winners, 1, team1, team2, courtIndex));
        courtIndex++;
      }
    }
    return matches;
  }

  /**
   * Builds the matches unlocked by the latest result: winners matches whose
   * participants are known, consolation rounds, and a 3rd-place match only when
   * the semi-final round has two real matches — a lone semi-final loser is 3rd
   * automatically.
   */
  private generateFollowUpMatches(allMatches: TournamentMatch[]): TournamentMatch[] {
    const winnersMatches = allMatches.filter(m => m.bracket === BracketKind.Winners);
    const consolationMatches = allMatches.filter(m => m.bracket === BracketKind.Consolation);
    const thirdPlaceExists = allMatches.some(m => m.bracket === BracketKind.ThirdPlace);

    const newWB = this.nextWinnersRoundMatches(winnersMatches, allMatches.length);
    const newCB = this.nextConsolationMatches(
      winnersMatches, consolationMatches, allMatches.length + newWB.length,
    );
    const newTP = thirdPlaceExists ? [] : this.nextThirdPlaceMatches(
      [...winnersMatches, ...newWB], allMatches.length + newWB.length + newCB.length,
    );

    return [...newWB, ...newCB, ...newTP];
  }

  /**
   * Generates each winners match as soon as both of its feeder slots are
   * decided — without waiting for the rest of the round to finish.
   */
  private nextWinnersRoundMatches(
    winnersMatches: TournamentMatch[],
    startCourtIndex: number,
  ): TournamentMatch[] {
    const { teams } = this._state;
    const bracketSize = this.bracketSize();
    const totalWBRounds = this.totalRounds();
    const newMatches: TournamentMatch[] = [];
    let courtIndex = startCourtIndex;

    for (let round = 2; round <= totalWBRounds; round++) {
      const positions = positionsInRound(bracketSize, round);
      for (let pos = 0; pos < positions; pos++) {
        const teamA = resolvePosition(round - 1, 2 * pos, teams, winnersMatches);
        const teamB = resolvePosition(round - 1, 2 * pos + 1, teams, winnersMatches);
        if (teamA === 'bye' || teamA === 'tbd' || teamB === 'bye' || teamB === 'tbd') continue;
        if (findMatchBetween(round, teamA, teamB, winnersMatches)) continue;
        newMatches.push(this.makeMatch(BracketKind.Winners, round, teamA, teamB, courtIndex));
        courtIndex++;
      }
    }

    return newMatches;
  }

  /** True once every slot of the WB round has resolved to a team or a bye. */
  private wbRoundFullyDecided(winnersMatches: TournamentMatch[], round: number): boolean {
    const positions = positionsInRound(this.bracketSize(), round);
    for (let pos = 0; pos < positions; pos++) {
      if (resolvePosition(round, pos, this._state.teams, winnersMatches) === 'tbd') return false;
    }
    return true;
  }

  /**
   * One seed slot per real WB first-round match, in position order: the
   * match's loser once decided, `null` until then. Bye positions get no slot.
   */
  private cbSeedSlots(winnersMatches: TournamentMatch[]): SeedSlots {
    const { teams } = this._state;
    const slots: Array<TournamentTeam | null> = [];
    for (let pos = 0; pos < positionsInRound(this.bracketSize(), 1); pos++) {
      if (!teams[2 * pos] || !teams[2 * pos + 1]) continue;
      slots.push(getWinnersFirstRoundLoser(pos, teams, winnersMatches));
    }
    return slots;
  }

  /**
   * Seeds each consolation first-round match as soon as both paired WB losers
   * are known, then advances completed CB rounds. Advancement waits for the
   * full WB first round: the advancer pool (and its bye-passers) is only
   * meaningful once every seed slot is filled.
   */
  private nextConsolationMatches(
    winnersMatches: TournamentMatch[],
    consolationMatches: TournamentMatch[],
    startCourtIndex: number,
  ): TournamentMatch[] {
    const totalWBRounds = this.totalRounds();
    const newMatches: TournamentMatch[] = [];

    const slots = this.cbSeedSlots(winnersMatches);
    for (let pair = 0; 2 * pair + 1 < slots.length; pair++) {
      const teamA = slots[2 * pair];
      const teamB = slots[2 * pair + 1];
      if (!teamA || !teamB || findMatchBetween(1, teamA, teamB, consolationMatches)) continue;
      newMatches.push(this.makeMatch(
        BracketKind.Consolation, 1, teamA, teamB, startCourtIndex + newMatches.length,
      ));
    }

    if (!this.wbRoundFullyDecided(winnersMatches, 1)) return newMatches;

    const cbSeeds = slots.filter((s): s is TournamentTeam => s !== null);
    const allCB = [...consolationMatches, ...newMatches];
    const maxCBRound = allCB.length > 0 ? Math.max(...allCB.map(m => m.round)) : 0;

    for (let n = 1; n <= maxCBRound; n++) {
      if (!roundComplete(allCB, n)) break;
      if (this.roundExists(allCB, n + 1)) continue;

      const advancers: TournamentTeam[] = [...getCBExpectedPool(n + 1, cbSeeds, allCB)];

      if (advancers.length < 2 && n + 1 < totalWBRounds && this.wbRoundFullyDecided(winnersMatches, n + 1)) {
        for (const m of winnersMatches.filter(m => m.round === n + 1 && m.winner !== undefined)) {
          advancers.push(loserOf(m));
        }
      }

      if (advancers.length >= 2) {
        newMatches.push(...this.pairTeamsIntoMatches(
          BracketKind.Consolation, n + 1, advancers, startCourtIndex + newMatches.length,
        ));
      }
      break;
    }

    return newMatches;
  }

  /** Creates the 3rd-place match once both semi-finals are decided. */
  private nextThirdPlaceMatches(allWB: TournamentMatch[], courtIndex: number): TournamentMatch[] {
    const totalWBRounds = this.totalRounds();
    const semiFinalRound = totalWBRounds - 1;
    if (semiFinalRound < 2 || !roundComplete(allWB, semiFinalRound)) return [];

    const sfLosers = getWBSemiFinalLosers(allWB, totalWBRounds);
    if (sfLosers.length !== 2) return [];
    return [this.makeMatch(BracketKind.ThirdPlace, 1, sfLosers[0], sfLosers[1], courtIndex)];
  }

  start(teams: TournamentTeam[], numberOfCourts: number): EliminationTournament {
    return this.startSeeded(shuffleArray(teams), numberOfCourts);
  }

  /**
   * Start the bracket from an already-ordered team list (no shuffle), so a
   * caller can supply its own seeding — e.g. group-stage qualifiers.
   */
  startSeeded(teams: TournamentTeam[], numberOfCourts: number): EliminationTournament {
    const bracketSize = nextPowerOf2(teams.length);
    const setup = new EliminationTournament({ ...this._state, teams, numberOfCourts, bracketSize });
    const matches = setup.generateWinnersFirstRound();
    return new EliminationTournament({ ...setup._state, matches });
  }

  override withMatchResult(
    matchId: string,
    winner: 1 | 2,
    sets?: SetScore[],
  ): this {
    const existing = this._state.matches.find(m => m.id === matchId);
    if (!existing) return this;

    let updatedMatches = this.replaceMatch(this._state.matches, matchId, winner, sets);
    if (existing.winner !== undefined && existing.winner !== winner) {
      updatedMatches = this.withoutDependentMatches(updatedMatches, existing);
    }
    const followUp = this.generateFollowUpMatches(updatedMatches);
    const allMatches = [...updatedMatches, ...followUp];
    return this.rebuild({ ...this._state, matches: allMatches });
  }

  /**
   * Drops matches whose participants were derived from the changed match's old
   * result, so generateFollowUpMatches can rebuild them with the corrected team:
   * later rounds of the same bracket, and — for a winners-bracket change before
   * the final — the consolation rounds fed by it and the 3rd-place match.
   */
  private withoutDependentMatches(
    matches: TournamentMatch[],
    changed: TournamentMatch,
  ): TournamentMatch[] {
    const { bracket, round } = changed;
    const finalRound = this.totalRounds();
    return matches.filter(m => {
      if (m.bracket === bracket) return m.round <= round;
      if (bracket !== BracketKind.Winners || round >= finalRound) return true;
      if (m.bracket === BracketKind.Consolation) return m.round < round;
      return false;
    });
  }

  get winners(): WinnersBracket {
    return new WinnersBracket(
      this._state.teams,
      this._state.matches.filter(m => m.bracket === BracketKind.Winners),
      this.bracketSize(),
    );
  }

  get thirdPlaceMatch(): TournamentMatch | undefined {
    return this._state.matches.find(m => m.bracket === BracketKind.ThirdPlace);
  }

  get consolation(): ConsolationBracket {
    return new ConsolationBracket(
      this.cbSeedSlots(this._state.matches.filter(m => m.bracket === BracketKind.Winners)),
      this._state.matches.filter(m => m.bracket === BracketKind.Consolation),
      this.bracketSize(),
    );
  }

  override standingsSubtitle(): string {
    return this.isComplete() ? 'Final Results' : 'In Progress';
  }

  override showsPoints(): boolean {
    return false;
  }

  /** Ranks teams by winners-bracket elimination depth (later exit first), then losses/wins/diffs. */
  calculateStandings(): TournamentStandingRow[] {
    const standings = this.tallyStandings();
    const aliveDepth = this.totalRounds() + 1;
    const exit = new Map<string, number>();
    for (const m of this._state.matches) {
      if (m.bracket === BracketKind.Winners && m.winner !== undefined) exit.set(loserOf(m).id, m.round);
    }
    const depth = (id: string) => exit.get(id) ?? aliveDepth;

    return Array.from(standings.values()).sort(this.orderStandings([
      (a, b) => depth(b.team.id) - depth(a.team.id),
      (a, b) => a.lost - b.lost,
      (a, b) => b.won - a.won,
      (a, b) => b.scoreDiff - a.scoreDiff,
      (a, b) => b.setDiff - a.setDiff,
      (a, b) => this.compareByTeamName(a, b),
    ]));
  }

  completedRounds(): number {
    return this.winners.completedRounds();
  }

  totalRounds(): number {
    return this.winners.totalRounds();
  }

  bracketSize(): number {
    return this._state.bracketSize ?? nextPowerOf2(this._state.teams.length);
  }

  isComplete(): boolean {
    return this.allDecided();
  }
}
