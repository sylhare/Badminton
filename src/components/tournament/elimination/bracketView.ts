import type { BracketNode } from '../../../tournament/bracketTree';
import type { TournamentMatch } from '../../../tournament/types';

/** The inputs every bracket layout shares: the round columns, how to label a round, and the team-click handler. */
export interface BracketView {
  tree: BracketNode[][];
  roundLabel: (round: number, totalRounds: number) => string;
  onTeamClick: (match: TournamentMatch, teamNumber: 1 | 2) => void;
}
