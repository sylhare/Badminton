import { describe, expect, it } from 'vitest';

import type { Player } from '../../src/types';
import type { TournamentTeam } from '../../src/tournament/types';
import { RoundRobinTournament } from '../../src/tournament/RoundRobinTournament';
import { tournamentLevelInputs } from '../../src/tournament/tournamentLevels';

function player(id: string, level: number): Player {
  return { id, name: `Player ${id}`, isPresent: true, level };
}

function team(id: string, players: Player[]): TournamentTeam {
  return { id, players };
}

describe('tournamentLevelInputs', () => {
  const teamA = team('a', [player('a1', 40), player('a2', 60)]);
  const teamB = team('b', [player('b1', 55), player('b2', 45)]);
  const teamC = team('c', [player('c1', 50), player('c2', 50)]);

  function startTournament() {
    return RoundRobinTournament.create('doubles', 2).start([teamA, teamB, teamC], 2);
  }

  it('baseline is every participant deduped, snapshotting start-of-play levels', () => {
    const { baseline } = tournamentLevelInputs(startTournament());
    expect(baseline.map(p => p.id).sort()).toEqual(['a1', 'a2', 'b1', 'b2', 'c1', 'c2']);
    expect(baseline.find(p => p.id === 'a1')?.level).toBe(40);
    expect(baseline.find(p => p.id === 'b1')?.level).toBe(55);
  });

  it('includes only decided matches, mapped to court shape', () => {
    const tournament = startTournament();
    const firstMatch = tournament.matches()[0];
    const decided = tournament.withMatchResult(firstMatch.id, 1, { team1: 21, team2: 15 });

    const { courts } = tournamentLevelInputs(decided);

    expect(courts).toHaveLength(1);
    expect(courts[0].winner).toBe(1);
    expect(courts[0].score).toEqual({ team1: 21, team2: 15 });
    expect(courts[0].teams?.team1.map(p => p.id)).toEqual(firstMatch.team1.players.map(p => p.id));
    expect(courts[0].teams?.team2.map(p => p.id)).toEqual(firstMatch.team2.players.map(p => p.id));
  });

  it('returns no courts before any result is entered', () => {
    expect(tournamentLevelInputs(startTournament()).courts).toHaveLength(0);
  });

  it('orders decided matches by round then court number', () => {
    let tournament = startTournament();
    for (const match of tournament.matches()) {
      tournament = tournament.withMatchResult(match.id, 1, { team1: 21, team2: 10 });
    }
    const { courts } = tournamentLevelInputs(tournament);

    const sig = (team1Ids: string[], team2Ids: string[]) => `${team1Ids.join()}|${team2Ids.join()}`;
    const expected = tournament.matches()
      .slice()
      .sort((a, b) => a.round - b.round || a.courtNumber - b.courtNumber)
      .map(m => sig(m.team1.players.map(p => p.id), m.team2.players.map(p => p.id)));
    const actual = courts.map(c => sig(c.teams!.team1.map(p => p.id), c.teams!.team2.map(p => p.id)));

    expect(actual).toEqual(expected);
  });
});
