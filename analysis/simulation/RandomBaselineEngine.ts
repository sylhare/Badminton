import { BaseCourtAssignmentEngine } from '../../src/engines/BaseCourtAssignmentEngine';
import type { Court, ICourtAssignmentEngine, Player } from '../../src/types';
import { shuffleArray } from '../../src/utils/playerUtils';

/**
 * Uniform random assignment baseline with fair rotation.
 */
export class RandomBaselineEngine extends BaseCourtAssignmentEngine implements ICourtAssignmentEngine {
  readonly name = 'Random Baseline';
  readonly description = 'Uniform random assignment baseline with fair rotation.';

  protected generateAssignments(players: Player[], numberOfCourts: number, startCourtNum: number): Court[] {
    const courts: Court[] = [];
    const shuffled = shuffleArray(players);
    let idx = 0;

    for (let courtNum = startCourtNum; courtNum < startCourtNum + numberOfCourts; courtNum++) {
      const courtPlayers = shuffled.slice(idx, idx + 4);
      idx += 4;

      if (courtPlayers.length < 2) break;
      if (courtPlayers.length === 3) {
        idx--;
        courtPlayers.pop();
      }

      let teams: Court['teams'];
      if (courtPlayers.length === 4) {
        const splits = [
          { team1: [courtPlayers[0], courtPlayers[1]], team2: [courtPlayers[2], courtPlayers[3]] },
          { team1: [courtPlayers[0], courtPlayers[2]], team2: [courtPlayers[1], courtPlayers[3]] },
          { team1: [courtPlayers[0], courtPlayers[3]], team2: [courtPlayers[1], courtPlayers[2]] },
        ];
        teams = splits[Math.floor(Math.random() * splits.length)];
      } else {
        teams = { team1: [courtPlayers[0]], team2: [courtPlayers[1]] };
      }

      courts.push({ courtNumber: courtNum, players: courtPlayers, teams });
    }

    return courts;
  }

  protected evaluateTeamSplitCost(): number {
    return 0;
  }
}

export const engineRandom = new RandomBaselineEngine();

