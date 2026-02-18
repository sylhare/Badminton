import type { Player, Court } from '../../src/types';

export class RandomBaselineEngine {
  private static winCountMap: Map<string, number> = new Map();

  static reset(): void {
    this.winCountMap.clear();
  }

  static resetHistory(): void {
    this.winCountMap.clear();
  }

  static recordWins(courts: Court[]): void {
    for (const court of courts) {
      if (court.winner && court.teams) {
        const winningTeam = court.winner === 1 ? court.teams.team1 : court.teams.team2;
        for (const player of winningTeam) {
          this.winCountMap.set(player.id, (this.winCountMap.get(player.id) ?? 0) + 1);
        }
      }
    }
  }

  static getWinCounts(): Map<string, number> {
    return new Map(this.winCountMap);
  }

  static generate(players: Player[], numberOfCourts: number): Court[] {
    const presentPlayers = players.filter(p => p.isPresent);
    if (presentPlayers.length === 0) return [];

    const shuffled = [...presentPlayers].sort(() => Math.random() - 0.5);
    const capacity = numberOfCourts * 4;
    const onCourt = shuffled.slice(0, Math.min(shuffled.length, capacity));

    const courts: Court[] = [];
    let idx = 0;

    for (let courtNum = 1; courtNum <= numberOfCourts && idx + 3 < onCourt.length; courtNum++) {
      const courtPlayers = onCourt.slice(idx, idx + 4);
      idx += 4;

      if (courtPlayers.length < 4) break;

      const splits = [
        { team1: [courtPlayers[0], courtPlayers[1]], team2: [courtPlayers[2], courtPlayers[3]] },
        { team1: [courtPlayers[0], courtPlayers[2]], team2: [courtPlayers[1], courtPlayers[3]] },
        { team1: [courtPlayers[0], courtPlayers[3]], team2: [courtPlayers[1], courtPlayers[2]] },
      ];
      const teams = splits[Math.floor(Math.random() * 3)];

      courts.push({ courtNumber: courtNum, players: courtPlayers, teams });
    }

    return courts;
  }
}
