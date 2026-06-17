import type { Player } from '../types';
import { shuffleArray } from '../utils/playerUtils';

import { Tournament } from './Tournament';
import { BracketKind, DEFAULT_TOURNAMENT_STATE } from './types';
import type {
  TournamentFormat,
  TournamentMatch,
  TournamentStandingRow,
  TournamentState,
  TournamentTeam,
} from './types';
import { RoundRobinTournament } from './RoundRobinTournament';
import type { SeedSlots } from './bracketTree';
import {
  ConsolationBracket,
  WinnersBracket,
  findMatchBetween,
  getCBExpectedPool,
  getWBSemiFinalLosers,
  getWinnersFirstRoundLoser,
  nextPowerOf2,
  resolvePosition,
  roundComplete,
} from './bracketTree';

let elimMatchCounter = 0;

export class EliminationTournament extends Tournament {
  static create(
    format: TournamentFormat = 'doubles',
    numberOfCourts = 4,
  ): EliminationTournament {
    return new EliminationTournament({
      ...DEFAULT_TOURNAMENT_STATE,
      type: 'elimination',
      format,
      numberOfCourts,
    });
  }

  static fromState(state: TournamentState): EliminationTournament {
    return new EliminationTournament(state);
  }

  static createTeams(players: Player[], format: TournamentFormat): TournamentTeam[] {
    return RoundRobinTournament.createTeams(players, format);
  }

  private makeMatch(
    bracket: BracketKind,
    round: number,
    team1: TournamentTeam,
    team2: TournamentTeam,
    courtIndex: number,
  ): TournamentMatch {
    return {
      id: `elim-match-${Date.now()}-${elimMatchCounter++}`,
      round,
      courtNumber: (courtIndex % this._state.numberOfCourts) + 1,
      team1,
      team2,
      bracket,
    };
  }

  private roundExists(matches: TournamentMatch[], round: number): boolean {
    return matches.some(m => m.round === round);
  }

  private highestRoundMatch(matches: TournamentMatch[]): TournamentMatch | undefined {
    return matches.length > 0 ? matches.reduce((p, c) => c.round > p.round ? c : p) : undefined;
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
      const positions = bracketSize / Math.pow(2, round);
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
    const positions = this.bracketSize() / Math.pow(2, round);
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
    for (let pos = 0; pos < this.bracketSize() / 2; pos++) {
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

      const cbRoundN = allCB.filter(m => m.round === n);

      const advancers: TournamentTeam[] = cbRoundN
        .filter(m => m.winner !== undefined)
        .map(m => m.winner === 1 ? m.team1 : m.team2);

      const cbRnParticipantIds = new Set(cbRoundN.flatMap(m => [m.team1.id, m.team2.id]));
      const expectedPool = getCBExpectedPool(n, cbSeeds, allCB);
      for (const team of expectedPool) {
        if (!cbRnParticipantIds.has(team.id)) advancers.push(team);
      }

      if (advancers.length < 2 && n + 1 < totalWBRounds && this.wbRoundFullyDecided(winnersMatches, n + 1)) {
        for (const m of winnersMatches.filter(m => m.round === n + 1 && m.winner !== undefined)) {
          advancers.push(m.winner === 1 ? m.team2 : m.team1);
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
    const shuffled = shuffleArray(teams);
    const bracketSize = nextPowerOf2(shuffled.length);
    const setup = new EliminationTournament({ ...this._state, teams: shuffled, numberOfCourts, bracketSize });
    const matches = setup.generateWinnersFirstRound();
    return new EliminationTournament({ ...setup._state, phase: 'active', matches });
  }

  override withMatchResult(
    matchId: string,
    winner: 1 | 2,
    score?: { team1: number; team2: number },
  ): this {
    const existing = this._state.matches.find(m => m.id === matchId);
    if (!existing) return this;

    let updatedMatches = this._state.matches.map(m =>
      m.id === matchId ? { ...m, winner, score: score ?? m.score } : m,
    );
    if (existing.winner !== undefined && existing.winner !== winner) {
      updatedMatches = this.withoutDependentMatches(updatedMatches, existing);
    }
    const followUp = this.generateFollowUpMatches(updatedMatches);
    const allMatches = [...updatedMatches, ...followUp];
    const phase = allMatches.length > 0 && allMatches.every(m => m.winner !== undefined) ? 'completed' : 'active';
    return new EliminationTournament({ ...this._state, matches: allMatches, phase }) as unknown as this;
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

  /**
   * Ranks teams by bracket outcome — winners final, 3rd-place match or lone
   * semi-final loser, consolation final — then by fewest losses. Semi-final losers
   * are only ranked once the final is decided, so a pending finalist stays ahead.
   */
  calculateStandings(): TournamentStandingRow[] {
    const { teams, matches } = this._state;
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
        row2.lost++;
      } else {
        row2.won++;
        row1.lost++;
      }

      if (match.score) {
        const diff = match.score.team1 - match.score.team2;
        row1.scoreDiff += diff;
        row2.scoreDiff -= diff;
      }
    }

    const wbMatches = matches.filter(m => m.bracket === BracketKind.Winners);
    const cbMatches = matches.filter(m => m.bracket === BracketKind.Consolation);
    const tpMatches = matches.filter(m => m.bracket === BracketKind.ThirdPlace);
    const wbFinal = this.highestRoundMatch(wbMatches);
    const cbFinal = this.highestRoundMatch(cbMatches);
    const tpMatch = tpMatches.length > 0 ? tpMatches[0] : undefined;

    const placed: TournamentStandingRow[] = [];
    const placedIds = new Set<string>();
    const placeTeam = (teamId: string) => {
      if (placedIds.has(teamId)) return;
      const row = standings.get(teamId);
      if (!row) return;
      placed.push(row);
      placedIds.add(teamId);
    };
    const placeMatchResult = (match: TournamentMatch | undefined) => {
      if (!match?.winner) return;
      placeTeam((match.winner === 1 ? match.team1 : match.team2).id);
      placeTeam((match.winner === 1 ? match.team2 : match.team1).id);
    };

    const totalRounds = this.totalRounds();
    placeMatchResult(wbFinal);
    placeMatchResult(tpMatch);
    if (wbFinal?.winner !== undefined && totalRounds - 1 >= 2) {
      for (const loser of getWBSemiFinalLosers(wbMatches, totalRounds)) {
        placeTeam(loser.id);
      }
    }
    placeMatchResult(cbFinal);

    const unplaced = Array.from(standings.values())
      .filter(r => !placedIds.has(r.team.id))
      .sort((a, b) => {
        if (a.lost !== b.lost) return a.lost - b.lost;
        if (b.won !== a.won) return b.won - a.won;
        const nameA = a.team.players[0]?.name ?? '';
        const nameB = b.team.players[0]?.name ?? '';
        return nameA.localeCompare(nameB);
      });

    return [...placed, ...unplaced];
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
    const { matches } = this._state;
    if (matches.length === 0) return false;
    return matches.every(m => m.winner !== undefined);
  }
}
