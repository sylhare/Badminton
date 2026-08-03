import { describe, expect, it } from 'vitest';

import { reconstructTournament } from '../../src/providers/AppStateProvider';
import { GroupKnockoutTournament } from '../../src/tournament/GroupKnockoutTournament';
import { EliminationTournament } from '../../src/tournament/EliminationTournament';
import { RoundRobinTournament } from '../../src/tournament/RoundRobinTournament';
import { createTournamentTeams } from '../data/testFactories';

describe('reconstructTournament', () => {
  it('rebuilds a group-knockout tournament from persisted state', () => {
    const t = GroupKnockoutTournament
      .create('doubles', 2, 1, 2, 1)
      .start(createTournamentTeams(['a', 'b', 'c', 'd']), 2);
    const rebuilt = reconstructTournament(t.state());
    expect(rebuilt).toBeInstanceOf(GroupKnockoutTournament);
    expect(rebuilt.matches().map(m => m.id)).toEqual(t.matches().map(m => m.id));
  });

  it('preserves an in-progress knockout across reconstruction and keeps advancing', () => {
    let t = GroupKnockoutTournament
      .create('doubles', 2, 1, 2, 1)
      .start(createTournamentTeams(['a', 'b', 'c', 'd']), 2);
    for (const id of t.groupMatches().map(m => m.id)) {
      t = t.withMatchResult(id, 1, [{ team1: 21, team2: 10 }]);
    }
    // Knockout has been seeded; rebuild from state and finish the final.
    const rebuilt = reconstructTournament(t.state()) as GroupKnockoutTournament;
    expect(rebuilt.knockoutStarted()).toBe(true);
    const finished = rebuilt.withMatchResult(rebuilt.knockoutMatches()[0].id, 1, [{ team1: 21, team2: 12 }]);
    expect(finished.isComplete()).toBe(true);
  });

  it('rebuilds round-robin and elimination from their state', () => {
    const rr = RoundRobinTournament.create('singles', 1).start(createTournamentTeams(['a', 'b']), 1);
    expect(reconstructTournament(rr.state())).toBeInstanceOf(RoundRobinTournament);

    const el = EliminationTournament.create('singles', 1).start(createTournamentTeams(['a', 'b', 'c', 'd']), 1);
    expect(reconstructTournament(el.state())).toBeInstanceOf(EliminationTournament);
  });
});
