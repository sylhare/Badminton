import React from 'react';

import type { BracketNode } from '../../../tournament/bracketTree';
import type { TournamentMatch } from '../../../tournament/types';
import { formatTeamName } from '../../../tournament/types';

interface BracketMatchNodeProps {
  node: BracketNode;
  cardHeight: number;
  onTeamClick: (match: TournamentMatch, teamNumber: 1 | 2) => void;
}

function teamClass(winner: 1 | 2 | undefined, teamNumber: 1 | 2): string {
  if (winner === teamNumber) return 'bracket-team bracket-team-winner';
  if (winner !== undefined) return 'bracket-team bracket-team-loser';
  return 'bracket-team';
}

export const BracketMatchNode: React.FC<BracketMatchNodeProps> = ({ node, cardHeight, onTeamClick }) => {
  const halfH = cardHeight / 2;

  if (node.type === 'empty') {
    return <div className="bracket-node bracket-node-empty" style={{ height: cardHeight }} />;
  }

  if (node.type === 'tbd') {
    return (
      <div className="bracket-node bracket-node-tbd" style={{ height: cardHeight }} data-testid="bracket-node-tbd">
        <div className="bracket-team bracket-team-tbd" style={{ height: halfH }}>TBD</div>
        <div className="bracket-team bracket-team-tbd" style={{ height: halfH }}>TBD</div>
      </div>
    );
  }

  if (node.type === 'bye-advance') {
    const name = node.team ? formatTeamName(node.team) : 'BYE';
    return (
      <div className="bracket-node bracket-node-bye" style={{ height: cardHeight }} data-testid="bracket-node-bye">
        <div className="bracket-team bracket-team-winner" style={{ height: halfH }}>{name}</div>
        <div className="bracket-team bracket-team-bye-label" style={{ height: halfH }}>BYE</div>
      </div>
    );
  }

  const match = node.match!;
  const w = match.winner;

  return (
    <div className="bracket-node bracket-node-match" style={{ height: cardHeight }} data-testid="bracket-node-match">
      {([1, 2] as const).map(side => (
        <button
          key={side}
          className={teamClass(w, side)}
          style={{ height: halfH }}
          onClick={() => onTeamClick(match, side)}
          data-testid={`bracket-team-${side}-${match.id}`}
        >
          {formatTeamName(side === 1 ? match.team1 : match.team2)}
          {w === side && <span className="bracket-winner-badge">✓</span>}
        </button>
      ))}
    </div>
  );
};

