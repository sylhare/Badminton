import type { BracketNode } from '../../../tournament/bracketTree';
import type { TournamentMatch } from '../../../tournament/types';

export interface BracketRoundHeader {
  label: string;
  testId: string;
}

/** The inputs every bracket layout shares: the round columns, round header info, and the team-click handler. */
export interface BracketView {
  tree: BracketNode[][];
  roundHeader: (round: number, totalRounds: number) => BracketRoundHeader;
  onTeamClick: (match: TournamentMatch, teamNumber: 1 | 2) => void;
}
