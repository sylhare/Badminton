import type { EliminationTournament } from '../../src/tournament/EliminationTournament';

export function playAllWBRounds(t: EliminationTournament): EliminationTournament {
  for (let r = 1; r <= t.totalRounds(); r++) {
    for (const m of t.winners.matchesForRound(r)) {
      if (m.winner === undefined) t = t.withMatchResult(m.id, 1);
    }
  }
  return t;
}

export function playAllCBRounds(t: EliminationTournament): EliminationTournament {
  for (let r = 1; r <= t.consolation.totalRounds(); r++) {
    for (const m of t.consolation.matchesForRound(r)) {
      if (m.winner === undefined) t = t.withMatchResult(m.id, 1);
    }
  }
  return t;
}

export function playWBRound(t: EliminationTournament, round: number): EliminationTournament {
  for (const m of t.winners.matchesForRound(round)) {
    if (m.winner === undefined) t = t.withMatchResult(m.id, 1);
  }
  return t;
}

export function playFullTournament(t: EliminationTournament): EliminationTournament {
  for (let r = 1; r <= t.totalRounds(); r++) {
    t = playWBRound(t, r);
    t = playAllCBRounds(t);
    if (t.thirdPlaceMatch && t.thirdPlaceMatch.winner === undefined) {
      t = t.withMatchResult(t.thirdPlaceMatch.id, 1);
    }
  }
  return t;
}
