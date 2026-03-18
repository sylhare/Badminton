import type { Player } from '../types';
import type {
  DEBracket,
  TournamentFormat,
  TournamentMatch,
  TournamentStandingRow,
  TournamentTeam,
} from '../types/tournament';

function makeTeamId(index: number): string {
  return `team-${Date.now()}-${index}`;
}

function makeMatchId(index: number): string {
  return `match-${Date.now()}-${index}`;
}

export function autoCreateDoubleTeams(players: Player[]): TournamentTeam[] {
  const teams: TournamentTeam[] = [];
  for (let i = 0; i < players.length; i += 2) {
    teams.push({
      id: makeTeamId(i),
      players: players.slice(i, i + 2),
    });
  }
  return teams;
}

export function autoCreateSingleTeams(players: Player[]): TournamentTeam[] {
  return players.map((p, i) => ({
    id: makeTeamId(i),
    players: [p],
  }));
}

export function generateRoundRobinMatches(
  teams: TournamentTeam[],
  numberOfCourts: number,
): TournamentMatch[] {
  const n = teams.length;
  if (n < 2) return [];

  const hasBye = n % 2 !== 0;
  const paddedTeams: (TournamentTeam | null)[] = hasBye
    ? [...teams, null]
    : [...teams];
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
        id: makeMatchId(matchIndex),
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

export function calculateStandings(
  teams: TournamentTeam[],
  matches: TournamentMatch[],
): TournamentStandingRow[] {
  const standings = new Map<string, TournamentStandingRow>();

  for (const team of teams) {
    standings.set(team.id, {
      team,
      played: 0,
      won: 0,
      lost: 0,
      points: 0,
      scoreDiff: 0,
    });
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
    const nameA = a.team.players[0]?.name ?? '';
    const nameB = b.team.players[0]?.name ?? '';
    return nameA.localeCompare(nameB);
  });
}

export function getCompletedRounds(matches: TournamentMatch[]): number {
  if (matches.length === 0) return 0;

  const roundMap = new Map<number, TournamentMatch[]>();
  for (const match of matches) {
    if (!roundMap.has(match.round)) roundMap.set(match.round, []);
    roundMap.get(match.round)!.push(match);
  }

  let completed = 0;
  const sortedRounds = Array.from(roundMap.keys()).sort((a, b) => a - b);

  for (const round of sortedRounds) {
    const roundMatches = roundMap.get(round)!;
    if (roundMatches.every(m => m.winner !== undefined)) {
      completed = round;
    } else {
      break;
    }
  }

  return completed;
}

export function getTotalRounds(matches: TournamentMatch[]): number {
  if (matches.length === 0) return 0;
  return Math.max(...matches.map(m => m.round));
}

export function generateDEFirstStage(
  teams: TournamentTeam[],
  numberOfCourts: number,
): { matches: TournamentMatch[]; deBracket: DEBracket } {
  const wbSlots = teams.map(t => t.id);
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const matches: TournamentMatch[] = [];
  let matchIndex = 0;

  // First team gets a bye if odd count
  const startIdx = wbSlots.length % 2 !== 0 ? 1 : 0;
  for (let i = startIdx; i + 1 < wbSlots.length; i += 2) {
    matches.push({
      id: makeMatchId(matchIndex),
      round: 1,
      courtNumber: (matchIndex % numberOfCourts) + 1,
      team1: teamMap.get(wbSlots[i])!,
      team2: teamMap.get(wbSlots[i + 1])!,
      bracket: 'winners',
    });
    matchIndex++;
  }

  return { matches, deBracket: { wbSlots, lbSlots: [] } };
}

export function generateNextDEStage(
  deBracket: DEBracket,
  teams: TournamentTeam[],
  completedMatches: TournamentMatch[],
  numberOfCourts: number,
): { newMatches: TournamentMatch[]; updatedBracket: DEBracket } {
  const teamMap = new Map(teams.map(t => [t.id, t]));

  const maxRound = Math.max(...completedMatches.map(m => m.round));
  const lastRoundMatches = completedMatches.filter(m => m.round === maxRound);
  const nextRound = maxRound + 1;

  const wbMatches = lastRoundMatches.filter(m => m.bracket === 'winners');
  const lbMatches = lastRoundMatches.filter(m => m.bracket === 'losers');

  const { wbSlots } = deBracket;
  const wbHadBye = wbSlots.length % 2 !== 0;
  const wbByeTeam = wbHadBye ? wbSlots[0] : null;

  const newWbSlots: string[] = wbByeTeam ? [wbByeTeam] : [];
  const newLbEntrants: string[] = [];

  for (const match of wbMatches) {
    const winnerId = match.winner === 1 ? match.team1.id : match.team2.id;
    const loserId = match.winner === 1 ? match.team2.id : match.team1.id;
    newWbSlots.push(winnerId);
    newLbEntrants.push(loserId);
  }

  const survivingLbSlots: string[] = [];
  for (const match of lbMatches) {
    const winnerId = match.winner === 1 ? match.team1.id : match.team2.id;
    survivingLbSlots.push(winnerId);
  }

  // Grand Final: 1 WB champion, 1 LB champion, no new LB entrants
  if (newWbSlots.length === 1 && survivingLbSlots.length === 1 && newLbEntrants.length === 0) {
    let matchIndex = completedMatches.length;
    const gfMatch: TournamentMatch = {
      id: makeMatchId(matchIndex),
      round: nextRound,
      courtNumber: (matchIndex % numberOfCourts) + 1,
      team1: teamMap.get(newWbSlots[0])!,
      team2: teamMap.get(survivingLbSlots[0])!,
      bracket: 'grand-final',
    };
    return {
      newMatches: [gfMatch],
      updatedBracket: { wbSlots: newWbSlots, lbSlots: survivingLbSlots },
    };
  }

  // Build LB pairs
  const newLbPairs: [string, string][] = [];
  if (survivingLbSlots.length === 0) {
    // First LB stage: pair entrants consecutively
    for (let i = 0; i + 1 < newLbEntrants.length; i += 2) {
      newLbPairs.push([newLbEntrants[i], newLbEntrants[i + 1]]);
    }
  } else if (newLbEntrants.length > 0) {
    // Cross-pair: survivor[i] vs entrant[i]
    const pairCount = Math.min(survivingLbSlots.length, newLbEntrants.length);
    for (let i = 0; i < pairCount; i++) {
      newLbPairs.push([survivingLbSlots[i], newLbEntrants[i]]);
    }
    // Extra survivors pair among themselves
    const extraSurvivors = survivingLbSlots.slice(pairCount);
    for (let i = 0; i + 1 < extraSurvivors.length; i += 2) {
      newLbPairs.push([extraSurvivors[i], extraSurvivors[i + 1]]);
    }
    // Extra entrants pair among themselves
    const extraEntrants = newLbEntrants.slice(pairCount);
    for (let i = 0; i + 1 < extraEntrants.length; i += 2) {
      newLbPairs.push([extraEntrants[i], extraEntrants[i + 1]]);
    }
  } else {
    // Only survivors: consolidation
    for (let i = 0; i + 1 < survivingLbSlots.length; i += 2) {
      newLbPairs.push([survivingLbSlots[i], survivingLbSlots[i + 1]]);
    }
  }

  const newMatches: TournamentMatch[] = [];
  let matchIndex = completedMatches.length;

  // WB matches
  if (newWbSlots.length >= 2) {
    const wbHasNewBye = newWbSlots.length % 2 !== 0;
    const startIdx = wbHasNewBye ? 1 : 0;
    for (let i = startIdx; i + 1 < newWbSlots.length; i += 2) {
      newMatches.push({
        id: makeMatchId(matchIndex),
        round: nextRound,
        courtNumber: (matchIndex % numberOfCourts) + 1,
        team1: teamMap.get(newWbSlots[i])!,
        team2: teamMap.get(newWbSlots[i + 1])!,
        bracket: 'winners',
      });
      matchIndex++;
    }
  }

  // LB matches
  for (const [id1, id2] of newLbPairs) {
    newMatches.push({
      id: makeMatchId(matchIndex),
      round: nextRound,
      courtNumber: (matchIndex % numberOfCourts) + 1,
      team1: teamMap.get(id1)!,
      team2: teamMap.get(id2)!,
      bracket: 'losers',
    });
    matchIndex++;
  }

  const newLbSlots: string[] = newLbPairs.flat();

  return {
    newMatches,
    updatedBracket: { wbSlots: newWbSlots, lbSlots: newLbSlots },
  };
}

export function isDoubleEliminationComplete(matches: TournamentMatch[]): boolean {
  const gfMatch = matches.find(m => m.bracket === 'grand-final');
  return gfMatch !== undefined && gfMatch.winner !== undefined;
}

export function validateTeams(
  teams: TournamentTeam[],
  format: TournamentFormat,
): string | null {
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
